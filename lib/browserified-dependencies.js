var simpleModal = require('simple-modal');

module.exports = function() {
  window.simpleModal = simpleModal;
  return {
    simpleModal: simpleModal
  };
};
