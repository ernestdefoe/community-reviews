import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import type { ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import type Review from '../models/Review';
import { failed, setting, t } from '../util';
import { reviewRow } from './cards';
import { scoreTile } from './bits';

interface Attrs extends ComponentAttrs {
  user: User;
}

type Tab = 'written' | 'merchant';

/**
 * A profile's Reviews tab: what the member wrote (MyBB's user widget) and the reviews that tag them as the merchant,
 * with their average (MyBB's merchant page and widget). A member who has left the Merchants group keeps the reviews
 * that name them: the tab shows for anyone in the group or named by at least one review the viewer can see.
 */
export default class UserReviews extends Component<Attrs> {
  private tab: Tab = 'written';
  private reviews: Review[] = [];
  private loading = true;
  private more = false;
  private seq = 0;
  private summary: { reviewCount: number; rating: number | null } | null = null;

  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);
    // Members of the group open on their merchant reviews; anyone else on what they wrote, switching to the merchant
    // reviews only when they wrote none (a former merchant). The summary is one request: two aggregates.
    if (this.inGroup()) this.tab = 'merchant';
    // No Merchants group set up: merchants are switched off, so there is no merchant tab to look up.
    if (setting('merchant_group')) this.loadSummary();
    this.load(0);
  }

  private loadSummary(): void {
    app
      .request<{ data: { attributes: { reviewCount: number; rating: number | null } } }>({
        method: 'GET',
        url: `${app.forum.attribute('apiUrl')}/reviews/merchant-summary?filter[merchant]=${this.attrs.user.id()}`,
      })
      .then((r) => {
        this.summary = r.data.attributes;
        if (this.tab === 'written' && !this.loading && !this.reviews.length && this.summary.reviewCount > 0) this.switchTo('merchant');
      })
      .catch(failed)
      .finally(() => m.redraw());
  }

  private inGroup(): boolean {
    const group = Number(setting('merchant_group'));
    return !!group && (this.attrs.user.groups() || []).some((g) => g && Number(g.id()) === group);
  }

  private isMerchant(): boolean {
    return this.inGroup() || (this.summary?.reviewCount || 0) > 0;
  }

  private switchTo(tab: Tab): void {
    this.tab = tab;
    this.load(0);
  }

  private load(offset: number): void {
    const seq = ++this.seq;
    this.loading = true;
    const filter = this.tab === 'merchant' ? { merchant: this.attrs.user.id()! } : { user: this.attrs.user.id()! };
    app.store
      .find<Review[]>('reviews', { filter, include: 'user,item,item.category', sort: '-createdAt', page: { offset, limit: 12, total: 0 } })
      .then((list) => {
        if (seq !== this.seq) return; // a newer list (another tab) was asked for meanwhile
        this.reviews = offset ? [...this.reviews, ...list] : [...list];
        this.more = !!list.payload?.links?.next;
        this.loading = false;
        if (this.tab === 'written' && !offset && !list.length && (this.summary?.reviewCount || 0) > 0) this.switchTo('merchant');
      })
      .catch(() => {
        if (seq === this.seq) this.loading = false;
        failed();
      })
      .finally(() => m.redraw());
  }

  view() {
    return (
      <div className="CR-userreviews">
        {this.isMerchant() && this.summary ? (
          <div className="CR-merchant">
            {scoreTile(this.summary.rating, 'CR-score--lg')}
            <div>
              <b>{t('profile.merchant_rating')}</b>
              <div className="CR-muted">{t('profile.merchant_help', { count: this.summary.reviewCount, name: this.attrs.user.displayName() })}</div>
            </div>
          </div>
        ) : null}
        {this.isMerchant() ? (
          <div className="CR-chips" role="tablist">
            {(['merchant', 'written'] as Tab[]).map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={this.tab === tab ? 'true' : 'false'}
                className={classList('CR-chip', this.tab === tab && 'is-active')}
                onclick={() => this.switchTo(tab)}
              >
                {t(`profile.tab_${tab}`)}
              </button>
            ))}
          </div>
        ) : null}
        {this.reviews.length ? (
          <div className="CR-rows">{this.reviews.map(reviewRow)}</div>
        ) : this.loading ? null : (
          <p className="CR-empty">{t('profile.empty')}</p>
        )}
        {this.loading ? <LoadingIndicator /> : null}
        {this.more && !this.loading ? (
          <Button className="Button Button--block CR-more" onclick={() => this.load(this.reviews.length)}>
            {t('page.load_more')}
          </Button>
        ) : null}
      </div>
    );
  }
}
