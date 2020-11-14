'use strict';

module.exports = {
  name: require('./package').name,

  netlifyRedirects() {
    return ['/* /index.html 200'];
  },
};
