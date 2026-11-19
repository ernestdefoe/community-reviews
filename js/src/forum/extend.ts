import Extend from 'flarum/common/extenders';
import Category from './models/Category';
import Criterion from './models/Criterion';
import Item from './models/Item';
import Review from './models/Review';
import Comment from './models/Comment';
import Report from './models/Report';
import { ui } from './util';

/*
 * The declarative half of the forum: models and routes. The pages are one lazy chunk (./ui).
 */

type PageName = 'CatalogPage' | 'ItemPage' | 'ReportsPage';
const page = (name: PageName) => () => ui().then(async (chunk) => (await chunk.loadCore(), { default: chunk[name] }));

export default [
  new Extend.Store()
    .add('review-categories', Category)
    .add('review-criteria', Criterion)
    .add('review-items', Item)
    .add('reviews', Review)
    .add('review-comments', Comment)
    .add('review-reports', Report),
  new Extend.Routes()
    .add('community-reviews.index', '/reviews', page('CatalogPage'))
    .add('community-reviews.category', '/reviews/c/:slug', page('CatalogPage'))
    .add('community-reviews.item', '/reviews/i/:id', page('ItemPage'))
    .add('community-reviews.reports', '/reviews/reports', page('ReportsPage'))
    .add('user.community-reviews', '/u/:username/reviews', () => ui().then(async (chunk) => ({ default: await chunk.userReviewsPage() }))),
];
