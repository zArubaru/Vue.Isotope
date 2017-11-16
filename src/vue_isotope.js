(function () {
  function buildVueIsotope(_, Isotope) {

    function addClass(node, classValue) {
      if (node.data) {
        const initValue = (!node.data.staticClass) ? "" : node.data.staticClass + " "
        node.data.staticClass = initValue + classValue
      }
    }

    function getItemVm(elmt) {
      return elmt.__underlying_element
    }

    // Reports errors
    function reportError(message, elmt) {
      const warningMessage = message ? `Warning template error: isotope ${message}` : 'Warning template error: isotope undefined error'
      if (elmt) {
        const opts = elmt.componentOptions
        const name = opts ? (opts.Ctor.options.name || opts.tag || '') : elmt.tag
        console.error(`${warningMessage}: <${name}>`)
      } else {
        console.error(warningMessage);
      }
    }

    const props = {
      options: {
        type: Object,
        default: {
          layoutMode: 'masonry',
          masonry: {
            gutter: 10
          }
        },
        sort: String
      },
      itemSelector: {
        type: String,
        default: "item"
      },
      list: {
        type: Array,
        required: true
      }
    }

    var isotopeComponent = {
      name: 'isotope',

      props,

      data() {
        // Get masonry gutter and colummWith classes
        let masonryOptions
        if (this.options && this.options.masonry) {
          masonryOptions = {
            gutter: this.options.masonry.gutter,
            columnWidth: this.options.masonry.columnWidth
          }
          // Remove the first dot from className
          Object.keys(masonryOptions).forEach((option) => {
            const currentOption = masonryOptions[option];
            if (typeof currentOption === 'string' && currentOption.length > 1) {
              masonryOptions[option] = currentOption.substr(1)
            }
          })
        }

        return {
          masonryOptions
        }
      },

      render(h) {
        const map = {}
        const prevChildren = this.prevChildren = this.children
        const rawChildren = this.$slots.default || []
        const children = this.children = []
        const removedIndex = this.removedIndex = []

        for (let i = 0; i < rawChildren.length; i++) {
          const c = rawChildren[i]
          if (c.tag) {
            if (c.key != null && String(c.key).indexOf('__vlist') !== 0) {
              if (map[c.key]) {
                reportError('children keys must be unique', c)
              }
              // Add single grid item class
              addClass(c, this.itemSelector)
              children.push(c)
              map[c.key] = c
            // Check for gutter (gutter-sizer) or column-width (grid-sizer)
            } else if (Object.keys(this.masonryOptions).length && c.data.attrs &&
                (c.data.attrs.gutter || c.data.attrs['column-width'])) {
              let newClass
              const gutterKey = '$gutter-sizer'
              const columnWidthKey = '$grid-sizer'
              if (c.data.attrs.gutter) {
                if (!this.masonryOptions.gutter) {
                  reportError("masonry options don't include a gutter property", c)
                } else if (this.masonryOptions.gutter !== c.data.attrs.gutter) {
                  reportError("masonry options' gutter property isn't equal to the gutter sizer's gutter property", c)
                }
                c.key = gutterKey
                newClass = c.data.attrs.gutter
              } else {
                if (!this.masonryOptions.columnWidth) {
                  reportError("masonry options don't include a columnWidth property", c)
                } else if (this.masonryOptions.columnWidth !== c.data.attrs['column-width']) {
                  reportError("masonry options' columnWidth property isn't equal to the gutter sizer's column-width property", c)
                }
                c.key = columnWidthKey
                newClass = c.data.attrs['column-width']
              }
              if (newClass) {
                if (map[c.key]) {
                  reportError('children keys must be unique, no duplicate gutter- or grid-sizers', c)
                } else {
                  // Add gutter-sizer or grid-sizer class
                  addClass(c, newClass)
                  children.push(c)
                  map[c.key] = c
                }
              } else if (c.key === gutterKey) {
                reportError("gutter-sizer doesn't have a gutter property", c)
              } else {
                reportError("grid-sizer doesn't have a column-width property", c)
              }
            } else {
              reportError('children must be keyed', c)
            }
          }
        }

        const displayChildren = this.displayChildren = [...children]

        if (prevChildren) {
          for (let i = 0; i < prevChildren.length; i++) {
            const c = prevChildren[i]
            if (!map[c.key]) {
              displayChildren.splice(i, 0, c)
              removedIndex.push(i)
            }
          }
        }

        return h('div', null, displayChildren)
      },

      mounted() {
        const options = _.merge({}, this.compiledOptions)
        var update = (object) => {
          _.forOwn(object, (value, key) => {
            object[key] = (itemElement) => { const res = getItemVm(itemElement); return value.call(this, res.vm, res.index); };
          });
        };
        update(options.getSortData)
        update(options.getFilterData);
        this._isotopeOptions = options
        if (options.filter) {
          options.filter = this.buildFilterFunction(options.filter)
        }

        this.$nextTick(() => {       
          this.link()
          this.listen()
          const iso = new Isotope(this.$el, options)

          iso._requestUpdate = () => {
            if (iso._willUpdate)
              return

            iso._willUpdate = true
            this.$nextTick(() => {
              iso.arrange()
              iso._willUpdate = false
            });
          };
          this.iso = iso
        })
      },

      beforeDestroy() {
        this.iso.destroy()
        _.forEach(this._listeners, (unlisten) => { unlisten(); })
        if (this._filterlistener) {
          this._filterlistener()
        }
        this.iso = null
      },

      beforeUpdate() {
        this._oldChidren = Array.prototype.slice.call(this.$el.children)
      },

      updated() {
        if (!this.iso) {
          return;
        }

        const newChildren = [...this.$el.children]
        const added = _.difference(newChildren, this._oldChidren)
        const removed = this.removedIndex.map(index => this.$el.children[index])

        this.cleanupNodes()
        this.link()

        if ((!removed.length) && (!added.length))
          return;

        this.listen()

        this.iso.remove(removed)
        this.iso.insert(added)
        this.iso._requestUpdate()
      },

      methods: {
        cleanupNodes() {
          this.removedIndex.reverse()
          this.removedIndex.forEach(index => this._vnode.children.splice(index, 1))
        },

        link() {
          const slots = this.$slots.default || []
          slots.forEach(
            (slot, index) => {
              const elmt = slot.elm
              if (elmt)
                elmt.__underlying_element = { vm: this.list[index], index }
            })
        },

        listen() {
          this._listeners = _(this.compiledOptions.getSortData).map((sort) => {
            return _.map(this.list, (collectionElement, index) => {
              return this.$watch(() => { return sort(collectionElement); }, () => {
                this.iso.updateSortData();
                this.iso._requestUpdate();
              });
            });
          }).flatten().value();
        },

        sort(name) {
          let sort = name
          if (_.isString(name)) {
            sort = { sortBy: name }
          }
          this.arrange(sort)
          this.$emit("sort", name)
        },

        buildFilterFunction (name) {
          const filter = this._isotopeOptions.getFilterData[name]
          this._filterlistener = this.$watch(() => { return _.map(this.list, (el, index) => this.options.getFilterData[name](el, index)); },
                                              () => { this.iso._requestUpdate(); });
          return filter
        },

        filter(name) {
          const filter = this.buildFilterFunction(name)
          this.arrange({ filter })
          this.$emit("filter", name)
        },

        unfilter() {
          this.arrange({ filter: () => { return true; } })
          this.$emit("filter", null)
        },

        layout(name) {
          let layout = name
          if (_.isString(name)) {
            layout = { layoutMode: name }
          }
          this.arrange(layout)
          this.$emit("layout", layout)
        },

        arrange(option) {
          this.iso.arrange(option)
          this.$emit("arrange", option)
        },

        shuffle() {
          this.iso.shuffle()
          this.$emit("shuffle")
          this.$emit("sort", null)
        },

        getFilteredItemElements() {
          return this.iso.getFilteredItemElements()
        },

        getElementItems() {
          return this.iso.getElementItems()
        }
      },

      computed: {
        compiledOptions() {
          const options = _.merge({}, this.options, { itemSelector: "." + this.itemSelector, isJQueryFiltering: false })

          _.forOwn(options.getSortData, (value, key) => {
            if (_.isString(value))
              options.getSortData[key] = (itemElement) => { return itemElement[value]; };
          });

          return options;
        }
      }
    };

    return isotopeComponent;
  }

  if (typeof exports == "object") {
    var _ = require("lodash"), Isotope = require("isotope-layout");
    module.exports = buildVueIsotope(_, Isotope);
  } else if (typeof define == "function" && define.amd) {
    define(['lodash', 'Isotope'], function (_, Isotope) { return buildVueIsotope(_, Isotope); });
  } else if ((window.Vue) && (window._) && (window.Isotope)) {
    var isotope = buildVueIsotope(window._, window.Isotope);
    Vue.component('isotope', isotope)
  }
})();
