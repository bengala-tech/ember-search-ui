import Route from '@ember/routing/route';
import { findGuide, GUIDES, type Guide } from '../guides/index.ts';

export default class GuideRoute extends Route<Guide> {
  model({ slug }: { slug: string }): Guide {
    return findGuide(slug) ?? GUIDES[0]!;
  }
}
