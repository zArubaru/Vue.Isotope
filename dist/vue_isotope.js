"use strict";

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

(function () {
  function buildVueIsotope(_, Isotope) {

    function addClass(node, classValue) {
      if (node.data) {
        var initValue = !node.data.staticClass ? "" : node.data.staticClass + " ";
        node.data.staticClass = initValue + classValue;
      }
    }

    function getItemVm(elmt) {
      return elmt.__underlying_element;
    }

    // Reports errors
    function reportError(message, elmt) {
      var warningMessage = message ? "Warning template error: isotope " + message : 'Warning template error: isotope undefined error';
      if (elmt) {
        var opts = elmt.componentOptions;
        var name = opts ? opts.Ctor.options.name || opts.tag || '' : elmt.tag;
        console.error(warningMessage + ": <" + name + ">");
      } else {
        console.error(warningMessage);
      }
    }

    var props = {
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
    };

    var isotopeComponent = {
      props: props,

      data: function data() {
        // Get masonry gutter and colummWith classes
        var masonryOptions = void 0;
        if (this.options && this.options.masonry) {
          masonryOptions = {
            gutter: this.options.masonry.gutter,
            columnWidth: this.options.masonry.columnWidth
            // Remove the first dot from className
          };Object.keys(masonryOptions).forEach(function (option) {
            var currentOption = masonryOptions[option];
            if (typeof currentOption === 'string' && currentOption.length > 1) {
              masonryOptions[option] = currentOption.substr(1);
            }
          });
        }

        return {
          masonryOptions: masonryOptions
        };
      },
      render: function render(h) {
        var map = {};
        var prevChildren = this.prevChildren = this.children;
        var rawChildren = this.$slots.default || [];
        var children = this.children = [];
        var removedIndex = this.removedIndex = [];

        for (var i = 0; i < rawChildren.length; i++) {
          var c = rawChildren[i];
          if (c.tag) {
            if (c.key != null && String(c.key).indexOf('__vlist') !== 0) {
              if (map[c.key]) {
                reportError('children keys must be unique', c);
              }
              // Add single grid item class
              addClass(c, this.itemSelector);
              children.push(c);
              map[c.key] = c;
              // Check for gutter (gutter-sizer) or column-width (grid-sizer)
            } else if (Object.keys(this.masonryOptions).length && c.data.attrs && (c.data.attrs.gutter || c.data.attrs['column-width'])) {
              var newClass = void 0;
              var gutterKey = '$gutter-sizer';
              var columnWidthKey = '$grid-sizer';
              if (c.data.attrs.gutter) {
                if (!this.masonryOptions.gutter) {
                  reportError("masonry options don't include a gutter property", c);
                } else if (this.masonryOptions.gutter !== c.data.attrs.gutter) {
                  reportError("masonry options' gutter property isn't equal to the gutter sizer's gutter property", c);
                }
                c.key = gutterKey;
                newClass = c.data.attrs.gutter;
              } else {
                if (!this.masonryOptions.columnWidth) {
                  reportError("masonry options don't include a columnWidth property", c);
                } else if (this.masonryOptions.columnWidth !== c.data.attrs['column-width']) {
                  reportError("masonry options' columnWidth property isn't equal to the gutter sizer's column-width property", c);
                }
                c.key = columnWidthKey;
                newClass = c.data.attrs['column-width'];
              }
              if (newClass) {
                if (map[c.key]) {
                  reportError('children keys must be unique, no duplicate gutter- or grid-sizers', c);
                } else {
                  // Add gutter-sizer or grid-sizer class
                  addClass(c, newClass);
                  children.push(c);
                  map[c.key] = c;
                }
              } else if (c.key === gutterKey) {
                reportError("gutter-sizer doesn't have a gutter property", c);
              } else {
                reportError("grid-sizer doesn't have a column-width property", c);
              }
            } else {
              reportError('children must be keyed', c);
            }
          }
        }

        var displayChildren = this.displayChildren = [].concat(children);

        if (prevChildren) {
          for (var _i = 0; _i < prevChildren.length; _i++) {
            var _c = prevChildren[_i];
            if (!map[_c.key]) {
              displayChildren.splice(_i, 0, _c);
              removedIndex.push(_i);
            }
          }
        }

        return h('div', null, displayChildren);
      },
      mounted: function mounted() {
        var _this = this;

        var options = _.merge({}, this.compiledOptions);
        var update = function update(object) {
          _.forOwn(object, function (value, key) {
            object[key] = function (itemElement) {
              var res = getItemVm(itemElement);return value.call(_this, res.vm, res.index);
            };
          });
        };
        update(options.getSortData);
        update(options.getFilterData);
        this._isotopeOptions = options;
        if (options.filter) {
          options.filter = this.buildFilterFunction(options.filter);
        }

        this.$nextTick(function () {
          _this.link();
          _this.listen();
          var iso = new Isotope(_this.$el, options);

          iso._requestUpdate = function () {
            if (iso._willUpdate) return;

            iso._willUpdate = true;
            _this.$nextTick(function () {
              iso.arrange();
              iso._willUpdate = false;
            });
          };
          _this.iso = iso;
        });
      },
      beforeDestroy: function beforeDestroy() {
        this.iso.destroy();
        _.forEach(this._listeners, function (unlisten) {
          unlisten();
        });
        if (this._filterlistener) {
          this._filterlistener();
        }
        this.iso = null;
      },
      beforeUpdate: function beforeUpdate() {
        this._oldChidren = Array.prototype.slice.call(this.$el.children);
      },
      updated: function updated() {
        var _this2 = this;

        if (!this.iso) {
          return;
        }

        var newChildren = [].concat(_toConsumableArray(this.$el.children));
        var added = _.difference(newChildren, this._oldChidren);
        var removed = this.removedIndex.map(function (index) {
          return _this2.$el.children[index];
        });

        this.cleanupNodes();
        this.link();

        if (!removed.length && !added.length) return;

        this.listen();

        this.iso.remove(removed);
        this.iso.insert(added);
        this.iso._requestUpdate();
      },


      methods: {
        cleanupNodes: function cleanupNodes() {
          var _this3 = this;

          this.removedIndex.reverse();
          this.removedIndex.forEach(function (index) {
            return _this3._vnode.children.splice(index, 1);
          });
        },
        link: function link() {
          var _this4 = this;

          var slots = this.$slots.default || [];
          slots.forEach(function (slot, index) {
            var elmt = slot.elm;
            if (elmt) elmt.__underlying_element = { vm: _this4.list[index], index: index };
          });
        },
        listen: function listen() {
          var _this5 = this;

          this._listeners = _(this.compiledOptions.getSortData).map(function (sort) {
            return _.map(_this5.list, function (collectionElement, index) {
              return _this5.$watch(function () {
                return sort(collectionElement);
              }, function () {
                _this5.iso.updateSortData();
                _this5.iso._requestUpdate();
              });
            });
          }).flatten().value();
        },
        sort: function sort(name) {
          var sort = name;
          if (_.isString(name)) {
            sort = { sortBy: name };
          }
          this.arrange(sort);
          this.$emit("sort", name);
        },
        buildFilterFunction: function buildFilterFunction(name) {
          var _this6 = this;

          var filter = this._isotopeOptions.getFilterData[name];
          this._filterlistener = this.$watch(function () {
            return _.map(_this6.list, function (el, index) {
              return _this6.options.getFilterData[name](el, index);
            });
          }, function () {
            _this6.iso._requestUpdate();
          });
          return filter;
        },
        filter: function filter(name) {
          var filter = this.buildFilterFunction(name);
          this.arrange({ filter: filter });
          this.$emit("filter", name);
        },
        unfilter: function unfilter() {
          this.arrange({ filter: function filter() {
              return true;
            } });
          this.$emit("filter", null);
        },
        layout: function layout(name) {
          var layout = name;
          if (_.isString(name)) {
            layout = { layoutMode: name };
          }
          this.arrange(layout);
          this.$emit("layout", layout);
        },
        arrange: function arrange(option) {
          this.iso.arrange(option);
          this.$emit("arrange", option);
        },
        shuffle: function shuffle() {
          this.iso.shuffle();
          this.$emit("shuffle");
          this.$emit("sort", null);
        },
        getFilteredItemElements: function getFilteredItemElements() {
          return this.iso.getFilteredItemElements();
        },
        getElementItems: function getElementItems() {
          return this.iso.getElementItems();
        }
      },

      computed: {
        compiledOptions: function compiledOptions() {
          var options = _.merge({}, this.options, { itemSelector: "." + this.itemSelector, isJQueryFiltering: false });

          _.forOwn(options.getSortData, function (value, key) {
            if (_.isString(value)) options.getSortData[key] = function (itemElement) {
              return itemElement[value];
            };
          });

          return options;
        }
      }
    };

    return isotopeComponent;
  }

  if (typeof exports == "object") {
    var _ = require("lodash"),
        Isotope = require("isotope-layout");
    module.exports = buildVueIsotope(_, Isotope);
  } else if (typeof define == "function" && define.amd) {
    define(['lodash', 'Isotope'], function (_, Isotope) {
      return buildVueIsotope(_, Isotope);
    });
  } else if (window.Vue && window._ && window.Isotope) {
    var isotope = buildVueIsotope(window._, window.Isotope);
    Vue.component('isotope', isotope);
  }
})();
