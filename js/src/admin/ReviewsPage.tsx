import app from 'flarum/admin/app';
import ExtensionPage from 'flarum/admin/components/ExtensionPage';
import saveSettings from 'flarum/admin/utils/saveSettings';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Switch from 'flarum/common/components/Switch';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';
import type Category from '../forum/models/Category';
import type { ItemField } from '../forum/models/Category';
import type Criterion from '../forum/models/Criterion';

const EXT = 'ernestdefoe-community-reviews';
const t = (key: string, params: Record<string, unknown> = {}) => app.translator.trans(`${EXT}.admin.${key}`, params);
const tx = (key: string, params: Record<string, unknown> = {}) => app.translator.trans(`${EXT}.admin.${key}`, params, true) as unknown as string;

type Tab = 'categories' | 'settings' | 'merge';

/** A setting field: its key, type, and for selects the options (string keys, so JS keeps their order). */
interface Field {
  key: string;
  type: 'number' | 'text' | 'bool' | 'select';
  options?: string[];
  min?: number;
}

/** MyBB's settings, grouped, then our extras. Every one has a control here (the parity table). */
const GROUPS: { id: string; fields: Field[] }[] = [
  {
    id: 'lists',
    fields: [
      { key: 'item_order', type: 'select', options: ['name', 'rating', 'reviews', 'views', 'date'] },
      { key: 'item_order_dir', type: 'select', options: ['asc', 'desc'] },
      { key: 'display_order', type: 'select', options: ['desc', 'asc'] },
      { key: 'items_per_page', type: 'number', min: 1 },
      { key: 'reviews_per_page', type: 'number', min: 1 },
      { key: 'comments_per_page', type: 'number', min: 1 },
      { key: 'recent_limit', type: 'number', min: 1 },
      { key: 'widget_limit', type: 'number', min: 1 },
      { key: 'index_widget', type: 'bool' },
      { key: 'rank_min_reviews', type: 'number', min: 1 },
    ],
  },
  {
    id: 'items',
    fields: [
      { key: 'name_max', type: 'number', min: 1 },
      { key: 'card_name_max', type: 'number', min: 1 },
      { key: 'item_approval', type: 'bool' },
      { key: 'one_per_member', type: 'bool' },
    ],
  },
  {
    id: 'writing',
    fields: [
      { key: 'general_label', type: 'text' },
      { key: 'general_max', type: 'number', min: 1 },
      { key: 'comment_max', type: 'number', min: 1 },
      { key: 'criterion_comment_required', type: 'bool' },
      { key: 'ask_price_link', type: 'bool' },
      { key: 'review_approval', type: 'bool' },
    ],
  },
  {
    id: 'photos',
    fields: [
      { key: 'max_photos', type: 'number', min: 0 },
      { key: 'require_photo', type: 'bool' },
      { key: 'photo_host', type: 'select', options: ['local', 'imgur'] },
      { key: 'imgur_client_id', type: 'text' },
    ],
  },
  { id: 'merchants', fields: [{ key: 'merchant_group', type: 'select' }] },
  {
    id: 'extras',
    fields: [
      { key: 'extra_helpful', type: 'bool' },
      { key: 'extra_verified', type: 'bool' },
      { key: 'extra_pros_cons', type: 'bool' },
      { key: 'extra_rich_results', type: 'bool' },
    ],
  },
];

/**
 * The extension's admin page: Categories (with criteria and item fields), Settings (every MyBB option) and Merge.
 * The permission grid below it is core's (ExtensionPage keeps it).
 */
export default class ReviewsPage extends ExtensionPage {
  private tab: Tab = 'categories';
  private categories: Category[] = [];
  private busy = true;
  private selected: Category | null = null;
  private values: Record<string, string> = {};
  private saving = false;
  private newCategory = '';
  private newCriterion = '';
  private copyTarget: Record<string, string> = {};
  private mergeSource = '';
  private mergeTarget = '';
  private merging = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);
    GROUPS.forEach((g) => g.fields.forEach((f) => (this.values[f.key] = String(app.data.settings[`${EXT}.${f.key}`] ?? ''))));
    this.load();
  }

  private load(): void {
    this.busy = true;
    app.store
      .find<Category[]>('review-categories')
      .then((list) => {
        this.categories = [...list].sort((a, b) => a.position() - b.position());
        this.selected = this.selected ? this.categories.find((c) => c.id() === this.selected!.id()) || null : this.categories[0] || null;
      })
      .catch(() => app.alerts.show({ type: 'error' }, tx('load_failed')))
      .finally(() => {
        this.busy = false;
        m.redraw();
      });
  }

  content() {
    return (
      <div className="ExtensionPage-settings CRAdmin">
        <div className="container">
          <nav className="CRAdmin-tabs" role="tablist">
            {(['categories', 'settings', 'merge'] as Tab[]).map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={this.tab === tab ? 'true' : 'false'}
                className={classList('CRAdmin-tab', this.tab === tab && 'is-active')}
                onclick={() => (this.tab = tab)}
              >
                {t(`tabs.${tab}`)}
              </button>
            ))}
          </nav>
          {this.tab === 'categories' ? this.categoriesTab() : this.tab === 'settings' ? this.settingsTab() : this.mergeTab()}
        </div>
      </div>
    );
  }

  // ----- Categories -------------------------------------------------------------------------------------------

  private categoriesTab(): Mithril.Children {
    if (this.busy) return <LoadingIndicator />;
    return (
      <div className="CRAdmin-cats">
        <div className="CRAdmin-tree">
          <ul>
            {this.categories.map((c, i) => (
              <li className={classList(this.selected === c && 'is-active', c.parentId() && 'is-child')}>
                <button type="button" className="CRAdmin-treeItem" onclick={() => (this.selected = c)}>
                  {c.icon() ? <i className={c.icon()!} aria-hidden="true" /> : null} {c.name()} <span className="CRAdmin-count">{c.itemCount()}</span>
                </button>
                <span className="CRAdmin-move">
                  <Button
                    className="Button Button--icon Button--flat"
                    icon="fas fa-arrow-up"
                    disabled={i === 0}
                    aria-label={tx('categories.move_up')}
                    onclick={() => this.move(i, -1)}
                  />
                  <Button
                    className="Button Button--icon Button--flat"
                    icon="fas fa-arrow-down"
                    disabled={i === this.categories.length - 1}
                    aria-label={tx('categories.move_down')}
                    onclick={() => this.move(i, 1)}
                  />
                </span>
              </li>
            ))}
          </ul>
          {!this.categories.length ? <p className="helpText">{t('categories.empty')}</p> : null}
          <form
            className="CRAdmin-add"
            onsubmit={(e: SubmitEvent) => {
              e.preventDefault();
              this.addCategory();
            }}
          >
            <input
              className="FormControl"
              placeholder={tx('categories.new_placeholder')}
              aria-label={tx('categories.new_placeholder')}
              value={this.newCategory}
              oninput={(e: InputEvent) => (this.newCategory = (e.target as HTMLInputElement).value)}
            />
            <Button type="submit" className="Button" icon="fas fa-plus" disabled={!this.newCategory.trim()}>
              {t('categories.add')}
            </Button>
          </form>
        </div>
        <div className="CRAdmin-detail">{this.selected ? this.categoryEditor(this.selected) : null}</div>
      </div>
    );
  }

  private move(index: number, step: number): void {
    const list = [...this.categories];
    const [moved] = list.splice(index, 1);
    list.splice(index + step, 0, moved);
    this.categories = list;
    app
      .request({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/review-categories/order`, body: { order: list.map((c) => Number(c.id())) } })
      .then(() => this.load())
      .catch(() => this.load());
  }

  private addCategory(): void {
    const name = this.newCategory.trim();
    if (!name) return;
    app.store
      .createRecord<Category>('review-categories')
      .save({ name })
      .then((c) => {
        this.newCategory = '';
        this.selected = c as Category;
        this.load();
      })
      .catch(() => {
        /* app.request already showed the error */
      });
  }

  private categoryEditor(category: Category): Mithril.Children {
    const parents = this.categories.filter((c) => !c.parentId() && c !== category);
    const criteria = ((category.criteria() || []).filter(Boolean) as Criterion[]).sort((a, b) => a.position() - b.position());
    const save = (attrs: Record<string, unknown>) =>
      category
        .save(attrs)
        .then(() => m.redraw())
        .catch(() => {
          /* app.request already showed the error */
        });

    return (
      <div key={category.id()}>
        <section className="CRAdmin-section">
          <h3>{t('categories.details')}</h3>
          <div className="CRAdmin-grid">
            {this.text(tx('categories.name'), category.name(), (v) => save({ name: v }))}
            {this.text(tx('categories.icon'), category.icon() || '', (v) => save({ icon: v || null }), 'fas fa-cut')}
            {this.text(tx('categories.color'), category.color() || '', (v) => save({ color: v || null }), '#4d698e')}
            <div className="Form-group">
              <label>{t('categories.parent')}</label>
              <select
                className="FormControl"
                value={category.parentId() ? String(category.parentId()) : ''}
                onchange={(e: Event) => save({ parentId: Number((e.target as HTMLSelectElement).value) || null })}
              >
                <option value="">{t('categories.top_level')}</option>
                {parents.map((p) => (
                  <option value={p.id()}>{p.name()}</option>
                ))}
              </select>
            </div>
          </div>
          {this.text(tx('categories.description'), category.description() || '', (v) => save({ description: v || null }))}
        </section>

        <section className="CRAdmin-section">
          <h3>{t('criteria.title')}</h3>
          <p className="helpText">{t('criteria.help')}</p>
          <ul className="CRAdmin-criteria">{criteria.map((c, i) => this.criterionRow(c, i, criteria))}</ul>
          <form
            className="CRAdmin-add"
            onsubmit={(e: SubmitEvent) => {
              e.preventDefault();
              this.addCriterion(category);
            }}
          >
            <input
              className="FormControl"
              placeholder={tx('criteria.new_placeholder')}
              aria-label={tx('criteria.new_placeholder')}
              value={this.newCriterion}
              oninput={(e: InputEvent) => (this.newCriterion = (e.target as HTMLInputElement).value)}
            />
            <Button type="submit" className="Button" icon="fas fa-plus" disabled={!this.newCriterion.trim()}>
              {t('criteria.add')}
            </Button>
          </form>
        </section>

        {this.fieldsEditor(category, save)}

        <section className="CRAdmin-section CRAdmin-danger">
          <Button
            className="Button Button--danger"
            icon="far fa-trash-can"
            onclick={() => {
              if (!confirm(tx('categories.delete_confirm', { name: category.name() }))) return;
              category
                .delete()
                .then(() => {
                  this.selected = null;
                  this.load();
                })
                .catch(() => {
                  /* app.request already showed the error */
                });
            }}
          >
            {t('categories.delete')}
          </Button>
        </section>
      </div>
    );
  }

  private text(label: string, value: string, onsave: (value: string) => unknown, placeholder = ''): Mithril.Children {
    return (
      <div className="Form-group">
        <label>{label}</label>
        <input
          className="FormControl"
          value={value}
          placeholder={placeholder}
          onchange={(e: Event) => {
            const next = (e.target as HTMLInputElement).value.trim();
            if (next !== value) onsave(next);
          }}
        />
      </div>
    );
  }

  private criterionRow(c: Criterion, index: number, all: Criterion[]): Mithril.Children {
    const others = this.categories.filter((cat) => cat.id() !== this.selected?.id());
    const order = (step: number) => {
      const list = [...all];
      const [moved] = list.splice(index, 1);
      list.splice(index + step, 0, moved);
      app
        .request({ method: 'POST', url: `${app.forum.attribute('apiUrl')}/review-criteria/order`, body: { order: list.map((x) => Number(x.id())) } })
        .then(() => this.load())
        .catch(() => this.load());
    };
    return (
      <li className="CRAdmin-criterion" key={c.id()}>
        <input
          className="FormControl"
          value={c.name()}
          aria-label={tx('criteria.name')}
          onchange={(e: Event) =>
            c.save({ name: (e.target as HTMLInputElement).value.trim() }).catch(() => {
              /* app.request already showed the error */
            })
          }
        />
        <label className="CRAdmin-weight">
          {t('criteria.weight')}
          <select
            className="FormControl"
            value={String(c.weight())}
            onchange={(e: Event) =>
              c.save({ weight: Number((e.target as HTMLSelectElement).value) }).catch(() => {
                /* app.request already showed the error */
              })
            }
          >
            {['1', '2', '3', '4', '5'].map((w) => (
              <option value={w}>×{w}</option>
            ))}
          </select>
        </label>
        <Button
          className="Button Button--icon Button--flat"
          icon="fas fa-arrow-up"
          disabled={index === 0}
          aria-label={tx('criteria.move_up')}
          onclick={() => order(-1)}
        />
        <Button
          className="Button Button--icon Button--flat"
          icon="fas fa-arrow-down"
          disabled={index === all.length - 1}
          aria-label={tx('criteria.move_down')}
          onclick={() => order(1)}
        />
        {others.length ? (
          <select
            className="FormControl CRAdmin-copy"
            aria-label={tx('criteria.copy')}
            value={this.copyTarget[c.id()!] || ''}
            onchange={(e: Event) => {
              const target = (e.target as HTMLSelectElement).value;
              if (!target) return;
              app
                .request({
                  method: 'POST',
                  url: `${app.forum.attribute('apiUrl')}/review-criteria/${c.id()}/copy`,
                  body: { categoryId: Number(target) },
                })
                .then(() => {
                  app.alerts.show({ type: 'success' }, tx('criteria.copied'));
                  this.load();
                })
                .catch(() => {
                  /* app.request already showed the error */
                });
            }}
          >
            <option value="">{t('criteria.copy')}</option>
            {others.map((o) => (
              <option value={o.id()}>{o.name()}</option>
            ))}
          </select>
        ) : null}
        <Button
          className="Button Button--icon Button--flat"
          icon="far fa-trash-can"
          aria-label={tx('criteria.delete')}
          onclick={() => {
            if (confirm(tx('criteria.delete_confirm', { name: c.name() })))
              c.delete()
                .then(() => this.load())
                .catch(() => {
                  /* app.request already showed the error */
                });
          }}
        />
      </li>
    );
  }

  private addCriterion(category: Category): void {
    const name = this.newCriterion.trim();
    if (!name) return;
    app.store
      .createRecord<Criterion>('review-criteria')
      .save({ name, weight: 1, relationships: { category } } as never)
      .then(() => {
        this.newCriterion = '';
        this.load();
      })
      .catch(() => {
        /* app.request already showed the error */
      });
  }

  /** Spec fields (an extra in spirit, harmless when empty): shown on the item page, filled when adding a product. */
  private fieldsEditor(category: Category, save: (attrs: Record<string, unknown>) => unknown): Mithril.Children {
    const fields: ItemField[] = [...(category.itemFields() || [])];
    const commit = (next: ItemField[]) => save({ itemFields: next });
    return (
      <section className="CRAdmin-section">
        <h3>{t('fields.title')}</h3>
        <p className="helpText">{t('fields.help')}</p>
        {fields.map((f, i) => (
          <div className="CRAdmin-field">
            <input
              className="FormControl"
              value={f.label}
              aria-label={tx('fields.label')}
              onchange={(e: Event) => commit(fields.map((x, j) => (j === i ? { ...x, label: (e.target as HTMLInputElement).value } : x)))}
            />
            <select
              className="FormControl"
              value={f.type}
              aria-label={tx('fields.type')}
              onchange={(e: Event) =>
                commit(fields.map((x, j) => (j === i ? { ...x, type: (e.target as HTMLSelectElement).value as ItemField['type'] } : x)))
              }
            >
              {['text', 'number', 'choice'].map((type) => (
                <option value={type}>{t(`fields.type_${type}`)}</option>
              ))}
            </select>
            {f.type === 'choice' ? (
              <input
                className="FormControl"
                value={f.options.join(', ')}
                aria-label={tx('fields.options')}
                placeholder={tx('fields.options')}
                onchange={(e: Event) =>
                  commit(
                    fields.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            options: (e.target as HTMLInputElement).value
                              .split(',')
                              .map((o) => o.trim())
                              .filter(Boolean),
                          }
                        : x
                    )
                  )
                }
              />
            ) : (
              <span />
            )}
            <Button
              className="Button Button--icon Button--flat"
              icon="far fa-trash-can"
              aria-label={tx('fields.delete')}
              onclick={() => commit(fields.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        <Button
          className="Button"
          icon="fas fa-plus"
          onclick={() => commit([...fields, { key: '', label: tx('fields.new_label'), type: 'text', options: [], filter: false }])}
        >
          {t('fields.add')}
        </Button>
      </section>
    );
  }

  // ----- Settings -------------------------------------------------------------------------------------------

  private settingsTab(): Mithril.Children {
    return (
      <form
        className="CRAdmin-settings"
        onsubmit={(e: SubmitEvent) => {
          e.preventDefault();
          this.saveAll();
        }}
      >
        {GROUPS.map((group) => (
          <section className="CRAdmin-section">
            <h3>{t(`settings.${group.id}`)}</h3>
            {group.id === 'extras' ? <p className="helpText">{t('settings.extras_help')}</p> : null}
            <div className="CRAdmin-grid">{group.fields.map((f) => this.field(f))}</div>
          </section>
        ))}
        <Button type="submit" className="Button Button--primary" loading={this.saving}>
          {t('settings.save')}
        </Button>
        <p className="helpText">{t('settings.permissions_note')}</p>
      </form>
    );
  }

  private field(f: Field): Mithril.Children {
    const label = t(`settings.${f.key}`);
    const help = app.translator.trans(`${EXT}.admin.settings.${f.key}_help`, {}, true) as unknown as string;
    const hasHelp = help && help !== `${EXT}.admin.settings.${f.key}_help`;
    if (f.type === 'bool') {
      return (
        <div className="Form-group CRAdmin-bool">
          <Switch
            state={this.values[f.key] === '1' || this.values[f.key] === 'true'}
            onchange={(on: boolean) => (this.values[f.key] = on ? '1' : '0')}
          >
            {label}
          </Switch>
          {hasHelp ? <div className="helpText">{help}</div> : null}
        </div>
      );
    }
    let control: Mithril.Children;
    if (f.type === 'select') {
      const options =
        f.key === 'merchant_group'
          ? [
              { value: '0', label: tx('settings.no_group') },
              ...app.store
                .all('groups')
                .filter((g) => Number(g.id()) > 3)
                .map((g) => ({ value: String(g.id()), label: (g as any).namePlural() as string })),
            ]
          : (f.options || []).map((o) => ({ value: o, label: tx(`settings.${f.key}_${o}`) }));
      control = (
        <select
          className="FormControl"
          value={this.values[f.key] || options[0]?.value}
          onchange={(e: Event) => (this.values[f.key] = (e.target as HTMLSelectElement).value)}
        >
          {options.map((o) => (
            <option value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    } else {
      control = (
        <input
          className="FormControl"
          type={f.type === 'number' ? 'number' : 'text'}
          min={f.min}
          value={this.values[f.key]}
          oninput={(e: InputEvent) => (this.values[f.key] = (e.target as HTMLInputElement).value)}
        />
      );
    }
    return (
      <div className="Form-group">
        <label>{label}</label>
        {control}
        {hasHelp ? <div className="helpText">{help}</div> : null}
      </div>
    );
  }

  private saveAll(): void {
    this.saving = true;
    const payload: Record<string, string> = {};
    Object.entries(this.values).forEach(([key, value]) => (payload[`${EXT}.${key}`] = value));
    saveSettings(payload)
      .then(() => app.alerts.show({ type: 'success' }, tx('settings.saved')))
      .catch(() => {
        /* app.request already showed the error */
      })
      .finally(() => {
        this.saving = false;
        m.redraw();
      });
  }

  // ----- Merge ----------------------------------------------------------------------------------------------

  private mergeTab(): Mithril.Children {
    return (
      <form
        className="CRAdmin-section"
        onsubmit={(e: SubmitEvent) => {
          e.preventDefault();
          this.merge();
        }}
      >
        <h3>{t('merge.title')}</h3>
        <p className="helpText">{t('merge.help')}</p>
        <div className="CRAdmin-grid">
          <div className="Form-group">
            <label>{t('merge.source')}</label>
            <input
              className="FormControl"
              type="number"
              min="1"
              value={this.mergeSource}
              oninput={(e: InputEvent) => (this.mergeSource = (e.target as HTMLInputElement).value)}
            />
          </div>
          <div className="Form-group">
            <label>{t('merge.target')}</label>
            <input
              className="FormControl"
              type="number"
              min="1"
              value={this.mergeTarget}
              oninput={(e: InputEvent) => (this.mergeTarget = (e.target as HTMLInputElement).value)}
            />
          </div>
        </div>
        <Button type="submit" className="Button Button--primary" loading={this.merging} disabled={!this.mergeSource || !this.mergeTarget}>
          {t('merge.submit')}
        </Button>
      </form>
    );
  }

  private merge(): void {
    if (!confirm(tx('merge.confirm', { source: this.mergeSource, target: this.mergeTarget }))) return;
    this.merging = true;
    app
      .request({
        method: 'POST',
        url: `${app.forum.attribute('apiUrl')}/review-items/${Number(this.mergeSource)}/merge`,
        body: { targetId: Number(this.mergeTarget) },
      })
      .then(() => {
        app.alerts.show({ type: 'success' }, tx('merge.done'));
        this.mergeSource = '';
        this.mergeTarget = '';
      })
      .catch(() => {
        /* app.request already showed the error */
      })
      .finally(() => {
        this.merging = false;
        m.redraw();
      });
  }
}
