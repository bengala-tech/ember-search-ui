import EmberRouter from '@embroider/router';
import config from 'docs/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('guide', { path: '/guides/:slug' });
  this.route('api');
  this.route('examples');
  this.route('legacy', { path: '/examples/legacy' });
  this.route('groups', { path: '/examples/groups' });
  this.route('legacy-template', { path: '/examples/templates/legacy' });
  this.route('groups-template', { path: '/examples/templates/groups' });
  this.route('properties', { path: '/examples/properties' });
});
