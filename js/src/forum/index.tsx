import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import Separator from 'flarum/common/components/Separator';
import type ItemList from 'flarum/common/utils/ItemList';
import type UserPage from 'flarum/forum/components/UserPage';
import type Mithril from 'mithril';
import type Category from './models/Category';
import extenders, { NOTIFICATIONS } from './extend';
import LatestReviews from './LatestReviews';
import { setting, t, ui } from './util';

export { extenders as extend };

export { default as Item } from './models/Item';
export { default as Review } from './models/Review';

/*
 * forum.js carries the models, the routes and the navigation. The pages, the composer and the modals are one
 * lazy chunk (./ui), fetched the first time someone opens Reviews.
 */

/** Whether the current page is one of ours (the sidebar then lists the categories). */
function onReviewsPage(): boolean {
  const name = app.current.get('routeName') as string | undefined;
  return !!name && name.startsWith('community-reviews.');
}

app.initializers.add('ernestdefoe-community-reviews', () => {
  // On review pages the sidebar's main button adds a product, the way IndexPage's starts a discussion.
  extend('flarum/forum/components/IndexSidebar', 'items', function (items: ItemList<Mithril.Children>) {
    if (!onReviewsPage() || !items.has('newDiscussion')) return;
    items.remove('newDiscussion');
    if (!app.forum.attribute('communityReviewsCanAddItems')) return;
    items.add(
      'communityReviewsAdd',
      <Button
        className="Button Button--primary IndexPage-newDiscussion"
        icon="fas fa-plus"
        onclick={() => ui().then((chunk) => chunk.openAddItem(null))}
      >
        {t('page.add_item')}
      </Button>,
      100
    );
  });

  extend('flarum/forum/components/IndexSidebar', 'navItems', function (items: ItemList<Mithril.Children>) {
    if (!app.forum.attribute('communityReviewsCanView')) return;
    items.add(
      'communityReviews',
      <LinkButton
        href={app.route('community-reviews.index')}
        icon="fas fa-star-half-stroke"
        active={
          onReviewsPage() &&
          !(app.current.get('routeName') as string).startsWith('community-reviews.category') &&
          app.current.get('routeName') !== 'community-reviews.reports'
        }
      >
        {t('nav.reviews')}
      </LinkButton>,
      75
    );

    if (app.forum.attribute('communityReviewsCanModerate')) {
      const open = Number(app.forum.attribute('communityReviewsOpenReports') || 0);
      // The count is drawn by CSS from an attribute: SelectDropdown repeats the active item's label,
      // and one vnode in two places throws when it changes.
      items.add(
        'communityReviewsReports',
        <LinkButton
          href={app.route('community-reviews.reports')}
          icon="fas fa-flag"
          className="CommunityReviewsNav-reports"
          data-count={open ? (open > 99 ? '99+' : String(open)) : undefined}
        >
          {t('nav.reports')}
        </LinkButton>,
        74
      );
    }

    if (!onReviewsPage()) return;
    const categories = app.store.all<Category>('review-categories').sort((a, b) => a.position() - b.position());
    if (!categories.length) return;
    items.add('communityReviewsSeparator', <Separator />, 60);
    const parents = categories.filter((c) => !c.parentId());
    parents.forEach((category, index) => {
      const children = categories.filter((c) => c.parentId() === Number(category.id()));
      items.add(
        `communityReviewsCategory${category.id()}`,
        <LinkButton
          href={app.route('community-reviews.category', { slug: category.slug() })}
          icon={category.icon() || 'fas fa-folder'}
          className="CommunityReviewsNav-category"
        >
          {category.name()}
        </LinkButton>,
        50 - index * 2
      );
      children.forEach((child, i) =>
        items.add(
          `communityReviewsCategory${child.id()}`,
          <LinkButton href={app.route('community-reviews.category', { slug: child.slug() })} className="CommunityReviewsNav-child">
            {child.name()}
          </LinkButton>,
          49 - index * 2 - i * 0.01
        )
      );
    });
  });

  // MyBB's index widget ({$community_reviews_widget} at index_end): the latest reviews under the discussion list, when the admin turns it on.
  extend('flarum/forum/components/IndexPage', 'contentItems', function (items: ItemList<Mithril.Children>) {
    if (setting('index_widget') && app.forum.attribute('communityReviewsCanView')) items.add('communityReviews', <LatestReviews />, -100);
  });

  extend(
    'flarum/forum/components/NotificationGrid',
    'notificationTypes',
    function (items: ItemList<{ name: string; icon: string; label: Mithril.Children }>) {
      Object.entries(NOTIFICATIONS).forEach(([name, icon]) => items.add(name, { name, icon, label: t(`notifications.${name}_preference`) }));
    }
  );

  extend('flarum/forum/components/UserPage', 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    if (!this.user || !app.forum.attribute('communityReviewsCanView')) return;
    items.add(
      'communityReviews',
      <LinkButton href={app.route('user.community-reviews', { username: this.user.slug() })} icon="fas fa-star-half-stroke">
        {t('nav.reviews')}
      </LinkButton>,
      84
    );
  });
});
