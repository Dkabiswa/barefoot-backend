/* eslint-disable no-unused-vars */
/* eslint-disable class-methods-use-this */
import moment from 'moment';
import { Op } from 'sequelize';
import requestService from '../services/requestService';
import Response from '../utils/response';
import email from '../utils/mails/email';
import UserService from '../services/userService';
import UpdateEmail from '../utils/mails/update.email';
import ApprovalEmail from '../utils/mails/approval.email';
import Emitter from '../utils/eventEmitters/emitter';
/** Class representing a password util. */
class Requests {
  /**
   * @param {object} req request
   * @param {object} res response
   * @param {object} next middleware details
   * @return {function} requests
   */
  async trip(req, res, next) {
    try {
      const request = await requestService.findRequest({
        from: req.body.from.toUpperCase(),
        travelDate: req.body.travelDates,
        user: req.user.id
      });
      if (request) {
        return Response.conflictError(res, 'request already exists');
      }
      const {
        gender, passportNumber, passportName, role
      } = req.body;
      const oneway = {
        from: req.body.from.toUpperCase(),
        travelDate: req.body.travelDates,
        reason: req.body.reason.trim(),
        user: req.user.id,
        gender,
        passportNumber,
        passportName,
        role
      };
      const bothRequests = {
        ...oneway,
        returnDate: req.body.returnDate
      };
      const result = await requestService.addRequest(bothRequests, req.body.accommodations);
      return Response.customResponse(
        res,
        200,
        'Your request has been forwarded successfully',
        result
      );
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @param {object} req request
   * @param {object} res response
   * @param {object} next next
   * @return {function} requests
   */
  async getMyRequests(req, res, next) {
    try {
      const data = await requestService.findRequests({ user: req.user.id });
      return Response.customResponse(res, 200, 'Your requests were retrieved successfully', data);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @param {object} req request
   * @param {object} res response
   * @param {object} next next
   * @return {function} requests
   */
  async getRequest(req, res, next) {
    try {
      const data = await requestService.findRequests({ id: req.params.id });
      if (!data[0]) {
        return Response.notFoundError(res, 'request is not found');
      }
      return Response.customResponse(res, 200, 'Request found successfully', data);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @param {object} req request
   * @param {object} res response
   * @param {object} next next
   * @return {function} Get requests with pending status
   */
  async getPendingApprovals(req, res, next) {
    try {
      const field = { status: 'Pending' };
      const data = await requestService.findRequests(field);
      const message = data.length > 0 ? 'Requests retrieved ' : 'No request pending approval';
      delete data.accommodations;
      return Response.customResponse(res, 200, message, data);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @param {object} req request
   * @param {object} res response
   * @param {object} next next
   * @return {function} requests
   */
  async rejectRequest(req, res, next) {
    try {
      const { reason } = req.body;
      const manager = req.user;
      const { requestId } = req.params;
      const request = await requestService.findRequest({ id: requestId });
      if (!request) {
        return Response.notFoundError(res, 'request not found');
      }
      const requesterId = request.user;
      if (request.status === 'Approved') {
        return Response.conflictError(res, 'Request already approved');
      }
      if (request.status === 'Rejected') {
        return Response.conflictError(res, 'Request already rejected');
      }
      const requester = await UserService.findUser({ id: requesterId });
      if (requester.emailAllowed) {
        const unsubscribeUrl = email.unsubscribeUrl({ userEmail: requester.userEmail });
        const data = await requestService.rejectUpdateRequest(requestId, 'Rejected');
        const header = email.header({
          from: manager.userEmail,
          to: requester.userEmail,
          subject: 'Request rejected'
        });
        const msg = ApprovalEmail.rejectAcceptRequestTemplate(reason, requester, unsubscribeUrl);
        await email.sendmail({ ...header, ...msg });
      }
      return Response.customResponse(res, 200, 'Request rejected successfully', { requestId });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @param {object} req request
   * @param {object} res response
   * @param {object} next next
   * @return {function} requests
   */
  async acceptRequest(req, res, next) {
    try {
      const { reason } = req.body;
      const manager = req.user;
      const { requestId } = req.params;
      const request = await requestService.findRequest({ id: requestId });
      if (!request) {
        return Response.notFoundError(res, 404, 'request not found');
      }
      const requesterId = request.user;
      if (request.status === 'Approved') {
        return Response.conflictError(res, 'Request already approved');
      }
      if (request.status === 'Rejected') {
        return Response.conflictError(res, 'Request already rejected');
      }
      const requester = await UserService.findUser({ id: requesterId });
      if (requester.emailAllowed) {
        const unsubscribeUrl = email.unsubscribeUrl({ userEmail: requester.userEmail });
        const data = await requestService.rejectUpdateRequest(requestId, 'Approved');
        const header = email.header({
          from: manager.userEmail,
          to: requester.userEmail,
          subject: 'Request approved'
        });
        const msg = ApprovalEmail.rejectAcceptRequestTemplate(reason, requester, unsubscribeUrl);
        await email.sendmail({ ...header, ...msg });
      }
      return Response.customResponse(res, 200, 'Request approved successfully', { requestId });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @param {object} req request
   * @param {object} res response
   * @param {object} next response
   * @return {function} requests
   */
  async EditRequest(req, res, next) {
    try {
      const formatedData = {
        ...req.body,
        travelDate: req.body.travelDates,
        reason: req.body.reason.trim()
      };
      const { id } = req.params;
      // update the object
      let data = await requestService.updateRequest(formatedData, id);
      const roleDetails = await UserService.findUser({ userRoles: 'Manager' });
      data = data.dataValues;
      await Emitter.emit('request edited', data);
      data.manager = roleDetails.dataValues.userEmail;
      data.user = req.user.firstName;
      if (roleDetails.emailAllowed) {
        const unsubscribeUrl = email.unsubscribeUrl({ userEmail: roleDetails.userEmail });
        const header = email.header({
          to: roleDetails.dataValues.userEmail,
          subject: ' BareFoot Update Notification '
        });
        const msg = UpdateEmail.updateTemplate({ ...data, unsubscribeUrl });
        const result = await email.sendmail({ ...header, ...msg });
      }
      return Response.customResponse(res, 200, 'Update has been completed successfully', data);
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @param {object} req request
   * @param {object} res response
   * @param {object} next next
   * @return {function} Get requests with pending status
   */
  async statistics(req, res, next) {
    try {
      const params = {
        travelDate: {
          [Op.gte]: [
            moment()
              .subtract(req.body.value, req.body.parameter)
              .format('YYYY-MM-DD')
          ],
          [Op.lt]: [moment().format('YYYY-MM-DD')]
        },
        status: 'Approved',
        user: req.user.id
      };
      const data = await requestService.findRequests(params);
      const message = 'Trip Statistics Succesfully retrieved';
      return Response.customResponse(res, 200, message, { total: data.length, trips: data });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * @param {object} req request
   * @param {object} res response
   * @param {object} next response
   * @return {function} requests
   */
  async deleteRequest(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = await requestService.deleteRequest(id);
      if (!deleted) throw Error('Could not deleted the request');
      return Response.customResponse(res, 200, 'The request has been deleted successfully');
    } catch (error) {
      return next(error);
    }
  }
}
export default new Requests();
