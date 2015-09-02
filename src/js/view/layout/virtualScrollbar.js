'use strict';

var View = require('../../base/view');

/**
 * virtual scrollbar
 * @constructor View.Layout.Frame.Rside.VirtualScrollBar
 */
var VirtualScrollBar = View.extend(/**@lends VirtualScrollBar.prototype */{
    tagName: 'div',
    className: 'virtual_scrollbar',
    events: {
        'scroll': '_onScroll',
        'mousedown': '_onMouseDown'
    },

    /**
     * 생성자 함수
     */
    initialize: function() {
        View.prototype.initialize.apply(this, arguments);
        this.setOwnProperties({
            hasFocus: false
        });
        this.listenTo(this.grid.dataModel, 'sort add remove reset', this._setHeight, this);
        this.listenTo(this.grid.dimensionModel, 'change', this._onDimensionChange, this);
        this.listenTo(this.grid.renderModel, 'change:scrollTop', this._onScrollTopChange, this);
        this.timeoutForScroll = 0;
    },

    /**
     * 마우스 down 이벤트 핸들러
     * 스크롤 핸들러를 직접 조작할 경우 rendering 성능 향상을 위해 매번 랜더링 하지 않고 한번에 랜더링 하기위해
     * hasFocus 내부 변수를 할당하고, document 에 mouseup 이벤트 핸들러를 바인딩한다.
     * @private
     */
    _onMouseDown: function() {
        this.hasFocus = true;
        $(document).on('mouseup', $.proxy(this._onMouseUp, this));
    },

    /**
     * 마우스 up 이벤트 핸들러
     * 바인딩 해제한다.
     * @private
     */
    _onMouseUp: function() {
        this.hasFocus = false;
        $(document).off('mouseup', $.proxy(this._onMouseUp, this));
    },
    /**
     * scroll 이벤트 발생시 renderModel 의 scroll top 값을 변경하여 frame 과 body 의 scrollTop 값을 동기화한다.
     * @param {event} scrollEvent 스크롤 이벤트
     * @private
     */
    _onScroll: function(scrollEvent) {
        clearTimeout(this.timeoutForScroll);
        if (this.hasFocus) {
            this.timeoutForScroll = setTimeout($.proxy(function() {
                this.grid.renderModel.set('scrollTop', scrollEvent.target.scrollTop);
            }, this), 0);
        }
    },
    /**
     * 크기 값이 변경될 때 해당 사항을 반영한다.
     * @param {object} model 변경이 발생한 모델
     * @private
     */
    _onDimensionChange: function(model) {
        if (model.changed['headerHeight'] || model.changed['bodyHeight']) {
            this.render();
        }
    },
    /**
     * scrollTop 이 변경된다면 scrollTop 값을 갱신하고,
     * scrollTop 값 자체가 잘못된 경우 renderModel 의 scrollTop 값을 정상값으로 갱신한다.
     * @param {object} model 변경이 발생한 모델
     * @param {number} value scrollTop 값
     * @private
     */
    _onScrollTopChange: function(model, value) {
        var scrollTop;
        this.el.scrollTop = value;
        scrollTop = this.el.scrollTop;
        if (scrollTop !== value) {
            this.grid.renderModel.set('scrollTop', scrollTop);
        }
    },

    /**
     * 랜더링한다.
     * @return {VirtualScrollBar} - This object
     */
    render: function() {
        var grid = this.grid,
            height = grid.dimensionModel.get('bodyHeight'),
            top = grid.dimensionModel.get('headerHeight');

        if (this.grid.option('scrollX')) {
            height -= this.grid.scrollBarSize;
        }

        this.$el.css({
            height: height + 'px',
            top: top + 'px',
            display: 'block'
        }).html('<div class="content"></div>');
        this._setHeight();
        return this;
    },

    /**
     * virtual scrollbar 의 height 를 설정한다.
     * @private
     */
    _setHeight: function() {
        var grid = this.grid,
            rowHeight = grid.dimensionModel.get('rowHeight'),
            rowCount = grid.dataModel.length,
            height = rowHeight * grid.dataModel.length + (rowCount + 1);

        this.$el.find('.content').height(height);
    },

    /**
     * 소멸자
     */
    destroy: function() {
        this.stopListening();
        this._onMouseUp();
        this.destroyChildren();
        this.remove();
    }
});

module.exports = VirtualScrollBar;