import EmberRouter from '@embroider/router';
import config from 'query-builder/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('legacy');
  this.route('groups');
});
