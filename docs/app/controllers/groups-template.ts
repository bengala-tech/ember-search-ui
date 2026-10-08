import ListController from '../example/search-controller.ts';

/**
 * The same controller sending the documented groups spec: OR groups, NOT
 * and disabled filters from a QueryBuilder. The URL is kept by <Search
 * @config> (the driver's own URL codec), so there is no `query` param.
 */
export default class GroupsTemplateController extends ListController {
  override filters = 'groups' as const;
}
