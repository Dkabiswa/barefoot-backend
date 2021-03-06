import emitter from '../../utils/eventEmitters/emitter';

export default (sequelize, DataTypes) => {
  const Comment = sequelize.define(
    'Comment',
    {
      user: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          isNumeric: true
        }
      },
      comment: {
        type: DataTypes.STRING,
        allowNull: false
      },
      request: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          isNumeric: true
        }
      },
      deleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
    },
    {}
  );
  Comment.associate = (models) => {
    Comment.belongsTo(models.Requests, {
      foreignKey: 'request',
      onDelete: 'CASCADE'
    });
    Comment.belongsTo(models.Users, {
      foreignKey: 'user',
      onDelete: 'CASCADE'
    });
  };
  Comment.afterCreate(({ dataValues }) => {
    emitter.emit('new comment', dataValues);
  });
  return Comment;
};
