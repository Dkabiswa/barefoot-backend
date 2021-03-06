import SessionManger from '../utils/sessionManager';
import Response from '../utils/response';
import userService from '../services/userService';

const verify = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];

    const payload = await SessionManger.decodeToken({ token });
    const result = await SessionManger.verifyToken(payload.userEmail);

    if (result === null) return Response.authenticationError(res, 'User not logged In');
    const { userEmail } = payload;
    // checking for the updated userRole from the db not from the token
    const { userRoles, emailAllowed, requestAutofill } = await userService.findUser({ userEmail });
    payload.userRoles = userRoles;
    payload.emailAllowed = emailAllowed;
    payload.requestAutofill = requestAutofill;
    req.user = payload;
    next();
  } catch (error) {
    return Response.authenticationError(res, 'Invalid or expired token used');
  }
};

export default verify;
