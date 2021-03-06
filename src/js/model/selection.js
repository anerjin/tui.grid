/**
 * @fileoverview Selection Model class
 * @author NHN Ent. FE Development Team
 */
'use strict';

var Model = require('../base/model');
var util = require('../common/util');
var typeConstMap = require('../common/constMap').selectionType;

/**
 * Selection Model class
 * @module model/selection
 * @extends module:base/view
 */
var Selection = Model.extend(/**@lends module:model/selection.prototype */{
    /**
     * @constructs
     * @param {Object} attr - Attributes
     * @param {Object} options - Options
     */
    initialize: function(attr, options) {
        Model.prototype.initialize.apply(this, arguments);

        this.setOwnProperties({
            dataModel: options.dataModel,
            columnModel: options.columnModel,
            dimensionModel: options.dimensionModel,
            focusModel: options.focusModel,
            renderModel: options.renderModel,

            inputRange: null,
            intervalIdForAutoScroll: null,
            scrollPixelScale: 40,
            enabled: true,
            selectionType: typeConstMap.CELL
        });

        this.listenTo(this.dataModel, 'add remove sort reset', this.end);
        this.listenTo(this.dataModel, 'paste', this._onPasteData);
    },

    defaults: {
        /**
         * Selection range
         * ex) {row: [0, 1], column: [1, 2]}
         * @type {{row: array, column: array}}
         */
        range: null
    },

    /**
     * Event handler for 'paste' event on DataModel
     * @param {Object} range - Range
     */
    _onPasteData: function(range) {
        this.start(range.startIdx.row, range.startIdx.column);
        this.update(range.endIdx.row, range.endIdx.column);
    },

    /**
     * Set selection type
     * @param {string} type - Selection type (CELL, ROW, COLUMN)
     */
    setType: function(type) {
        this.selectionType = typeConstMap[type] || this.selectionType;
    },

    /**
     * Return the selection type
     * @returns {string} type - Selection type (CELL, ROW, COLUMN)
     */
    getType: function() {
        return this.selectionType;
    },

    /**
     * Enables the selection.
     */
    enable: function() {
        this.enabled = true;
    },

    /**
     * Disables the selection.
     */
    disable: function() {
        this.end();
        this.enabled = false;
    },

    /**
     * Returns whether the selection is enabled.
     * @returns {boolean} True if the selection is enabled.
     */
    isEnabled: function() {
        return this.enabled;
    },

    /**
     * Starts the selection.
     * @param {Number} rowIndex - Row index
     * @param {Number} columnIndex - Column index
     * @param {string} type - Selection type
     */
    start: function(rowIndex, columnIndex, type) {
        if (!this.isEnabled()) {
            return;
        }

        this.setType(type);
        this.inputRange = {
            row: [rowIndex, rowIndex],
            column: [columnIndex, columnIndex]
        };
        this._resetRangeAttribute();
    },

    /**
     * Starts the selection by mouse position.
     * @param {number} pageX - X position relative to the document
     * @param {number} pageY - Y position relative to the document
     * @param {string} type - Selection type
     */
    startByMousePosition: function(pageX, pageY, type) {
        var index = this.dimensionModel.getIndexFromMousePosition(pageX, pageY);
        this.start(index.row, index.column, type);
    },

    /**
     * Updates the selection range.
     * @param {number} rowIndex - Row index
     * @param {number} columnIndex - Column index
     * @param {string} [type] - Selection type
     */
    update: function(rowIndex, columnIndex, type) {
        var focusedIndex;

        if (!this.enabled || rowIndex < 0 || columnIndex < 0) {
            return;
        }

        if (!this.hasSelection()) {
            focusedIndex = this.focusModel.indexOf();
            this.start(focusedIndex.row, focusedIndex.column, type);
        } else {
            this.setType(type);
        }

        this._updateInputRange(rowIndex, columnIndex);
        this._resetRangeAttribute();
    },

    /**
     * Update input range (end range, not start range)
     * @param {number} rowIndex - Row index
     * @param {number} columnIndex - Column index
     * @private
     */
    _updateInputRange: function(rowIndex, columnIndex) {
        var inputRange = this.inputRange;

        if (this.selectionType === typeConstMap.ROW) {
            columnIndex = this.columnModel.getVisibleColumnModelList().length - 1;
        } else if (this.selectionType === typeConstMap.COLUMN) {
            rowIndex = this.dataModel.length - 1;
        }

        inputRange.row[1] = rowIndex;
        inputRange.column[1] = columnIndex;
    },

    /**
     * Extend column selection
     * @param {undefined|Array} columnIndexes - Column indexes
     * @param {number} pageX - Mouse position X
     * @param {number} pageY - Mouse positino Y
     */
    extendColumnSelection: function(columnIndexes, pageX, pageY) {
        var minimumColumnRange = this._minimumColumnRange;
        var index = this.dimensionModel.getIndexFromMousePosition(pageX, pageY);
        var range = {
            row: [0, this.dataModel.length - 1],
            column: []
        };
        var minMax;

        if (!columnIndexes || !columnIndexes.length) {
            columnIndexes = [index.column];
        }

        this._setScrolling(pageX, pageY);
        if (minimumColumnRange) {
            minMax = util.getMinMax(columnIndexes.concat(minimumColumnRange));
        } else {
            columnIndexes.push(this.inputRange.column[0]);
            minMax = util.getMinMax(columnIndexes);
        }
        range.column.push(minMax.min, minMax.max);
        this._resetRangeAttribute(range);
    },

    /**
     * Set auto scrolling for selection
     * @param {number} pageX - Mouse position X
     * @param {number} pageY - Mouse positino Y
     * @private
     */
    _setScrolling: function(pageX, pageY) {
        var overflow = this.dimensionModel.getOverflowFromMousePosition(pageX, pageY);

        this.stopAutoScroll();
        if (this._isAutoScrollable(overflow.x, overflow.y)) {
            this.intervalIdForAutoScroll = setInterval(
                _.bind(this._adjustScroll, this, overflow.x, overflow.y)
            );
        }
    },

    /**
     * Updates the selection range by mouse position.
     * @param {number} pageX - X position relative to the document
     * @param {number} pageY - Y position relative to the document
     * @param {string} [type] - Selection type
     */
    updateByMousePosition: function(pageX, pageY, type) {
        var index = this.dimensionModel.getIndexFromMousePosition(pageX, pageY);

        this._setScrolling(pageX, pageY);
        this.update(index.row, index.column, type);
    },

    /**
     * selection 영역 선택을 종료하고 selection 데이터를 초기화한다.
     */
    end: function() {
        this.inputRange = null;
        this.unset('range');
        this.unsetMinimumColumnRange();
    },

    /**
     * Stops the auto-scroll interval.
     */
    stopAutoScroll: function() {
        if (!_.isNull(this.intervalIdForAutoScroll)) {
            clearInterval(this.intervalIdForAutoScroll);
            this.intervalIdForAutoScroll = null;
        }
    },

    /**
     * Select all data in a row
     * @param {Number} rowIndex - Row idnex
     */
    selectRow: function(rowIndex) {
        if (this.isEnabled()) {
            this.focusModel.focusAt(rowIndex, 0);
            this.start(rowIndex, 0, typeConstMap.ROW);
            this.update(rowIndex, this.columnModel.getVisibleColumnModelList().length - 1);
        }
    },

    /**
     * Select all data in a column
     * @param {Number} columnIdx - Column index
     */
    selectColumn: function(columnIdx) {
        if (this.isEnabled()) {
            this.focusModel.focusAt(0, columnIdx);
            this.start(0, columnIdx, typeConstMap.COLUMN);
            this.update(this.dataModel.length - 1, columnIdx);
        }
    },

    /**
     * Selects all data range.
     */
    selectAll: function() {
        if (this.isEnabled()) {
            this.start(0, 0, typeConstMap.CELL);
            this.update(this.dataModel.length - 1, this.columnModel.getVisibleColumnModelList().length - 1);
        }
    },

    /**
     * Returns the row and column indexes of the starting position.
     * @returns {{row: number, column: number}} Objects containing indexes
     */
    getStartIndex: function() {
        var range = this.get('range');

        return {
            row: range.row[0],
            column: range.column[0]
        };
    },

    /**
     * Returns the row and column indexes of the ending position.
     * @returns {{row: number, column: number}} Objects containing indexes
     */
    getEndIndex: function() {
        var range = this.get('range');

        return {
            row: range.row[1],
            column: range.column[1]
        };
    },

    /**
     * selection 데이터가 존재하는지 확인한다.
     * @returns {boolean} selection 데이터 존재여부
     */
    hasSelection: function() {
        return !!this.get('range');
    },

    /**
     * Returns whether given range is a single cell. (include merged cell)
     * @param {Array.<String>} columnNameList - columnNameList
     * @param {Array.<Object>} rowList - rowList
     * @returns {Boolean}
     */
    _isSingleCell: function(columnNameList, rowList) {
        var isSingleColumn = columnNameList.length === 1;
        var isSingleRow = rowList.length === 1;
        var isSingleMergedCell = isSingleColumn && !isSingleRow &&
            (rowList[0].getRowSpanData(columnNameList[0]).count === rowList.length);

        return (isSingleColumn && isSingleRow) || isSingleMergedCell;
    },

    /**
     * Returns the string value of all cells in the selection range as a single string.
     * @returns {String} string of values
     */
    getValuesToString: function() {
        var range = this.get('range');
        var columnModelList, rowList, columnNameList, rowValues;

        columnModelList = this.columnModel.getVisibleColumnModelList().slice(range.column[0], range.column[1] + 1);
        rowList = this.dataModel.slice(range.row[0], range.row[1] + 1);

        columnNameList = _.pluck(columnModelList, 'columnName');
        rowValues = _.map(rowList, function(row) {
            var tmpString = _.map(columnNameList, function(columnName) {
                return row.getValueString(columnName);
            });
            return tmpString.join('\t');
        });

        if (this._isSingleCell(columnNameList, rowList)) {
            return rowValues[0];
        }
        return rowValues.join('\n');
    },

    /**
     * 마우스 드래그로 selection 선택 시 auto scroll 조건에 해당하는지 반환한다.
     * @param {Number} overflowX    가로축 기준 영역 overflow 값
     * @param {Number} overflowY    세로축 기준 영역 overflow 값
     * @returns {boolean} overflow 되었는지 여부
     * @private
     */
    _isAutoScrollable: function(overflowX, overflowY) {
        return !(overflowX === 0 && overflowY === 0);
    },

    /**
     * Adjusts scrollTop and scrollLeft value.
     * @param {Number} overflowX    가로축 기준 영역 overflow 값
     * @param {Number} overflowY    세로축 기준 영역 overflow 값
     * @private
     */
    _adjustScroll: function(overflowX, overflowY) {
        var renderModel = this.renderModel;

        if (overflowX) {
            this._adjustScrollLeft(overflowX, renderModel.get('scrollLeft'), renderModel.get('maxScrollLeft'));
        }
        if (overflowY) {
            this._adjustScrollTop(overflowY, renderModel.get('scrollTop'), renderModel.get('maxScrollTop'));
        }
    },

    /**
     * Adjusts scrollLeft value.
     * @param  {number} overflowX - 1 | 0 | -1
     * @param  {number} scrollLeft - Current scrollLeft value
     * @param  {number} maxScrollLeft - Max scrollLeft value
     * @private
     */
    _adjustScrollLeft: function(overflowX, scrollLeft, maxScrollLeft) {
        var adjusted = scrollLeft;
        var pixelScale = this.scrollPixelScale;

        if (overflowX < 0) {
            adjusted = Math.max(0, scrollLeft - pixelScale);
        } else if (overflowX > 0) {
            adjusted = Math.min(maxScrollLeft, scrollLeft + pixelScale);
        }
        this.renderModel.set('scrollLeft', adjusted);
    },

    /**
     * Adjusts scrollTop value.
     * @param  {number} overflowY - 1 | 0 | -1
     * @param  {number} scrollTop - Current scrollTop value
     * @param  {number} maxScrollTop - Max scrollTop value
     * @private
     */
    _adjustScrollTop: function(overflowY, scrollTop, maxScrollTop) {
        var adjusted = scrollTop;
        var pixelScale = this.scrollPixelScale;

        if (overflowY < 0) {
            adjusted = Math.max(0, scrollTop - pixelScale);
        } else if (overflowY > 0) {
            adjusted = Math.min(maxScrollTop, scrollTop + pixelScale);
        }
        this.renderModel.set('scrollTop', adjusted);
    },

    /**
     * Expands the 'this.inputRange' if rowspan data exists, and resets the 'range' attributes to the value.
     * @param {{column: number[], row: number[]}} [inputRange] - Input range. Default is this.inputRange
     * @private
     */
    _resetRangeAttribute: function(inputRange) {
        var dataModel = this.dataModel;
        var hasSpannedRange, spannedRange, tmpRowRange;

        inputRange = inputRange || this.inputRange;
        if (!inputRange) {
            this.set('range', null);
            return;
        }

        spannedRange = {
            row: _.sortBy(inputRange.row),
            column: _.sortBy(inputRange.column)
        };

        if (dataModel.isRowSpanEnable() && this.selectionType === typeConstMap.CELL) {
            do {
                tmpRowRange = _.assign([], spannedRange.row);
                spannedRange = this._getRowSpannedIndex(spannedRange);

                hasSpannedRange = (
                    spannedRange.row[0] !== tmpRowRange[0] ||
                    spannedRange.row[1] !== tmpRowRange[1]
                );
            } while (hasSpannedRange);
            this._setRangeMinMax(spannedRange.row, spannedRange.column);
        }

        this.set('range', spannedRange);
    },

    /**
     * Set minimum column range
     * @param {Array} range - Minimum column range
     */
    setMinimumColumnRange: function(range) {
        this._minimumColumnRange = _.extend(range);
    },

    /**
     * Unset minimum column range
     */
    unsetMinimumColumnRange: function() {
        this._minimumColumnRange = null;
    },

    /**
     * Set min, max value of range(row, column)
     * @param {Array} rowRange - Row range
     * @param {Array} columnRange - Column range
     * @private
     */
    _setRangeMinMax: function(rowRange, columnRange) {
        if (rowRange) {
            rowRange[0] = Math.max(0, rowRange[0]);
            rowRange[1] = Math.min(this.dataModel.length - 1, rowRange[1]);
        }

        if (columnRange) {
            columnRange[0] = Math.max(0, columnRange[0]);
            columnRange[1] = Math.min(this.columnModel.getVisibleColumnModelList().length - 1, columnRange[1]);
        }
    },

    /**
     * row start index 기준으로 rowspan 을 확인하며 startRangeList 업데이트 하는 함수
     * @param {object} param - parameters
     * @private
     */
    _concatRowSpanIndexFromStart: function(param) {
        var startIndex = param.startIndex;
        var endIndex = param.endIndex;
        var columnName = param.columnName;
        var rowSpanData = param.startRowSpanDataMap && param.startRowSpanDataMap[columnName];
        var startIndexList = param.startIndexList;
        var endIndexList = param.endIndexList;
        var spannedIndex;

        if (!rowSpanData) {
            return;
        }

        if (!rowSpanData.isMainRow) {
            spannedIndex = startIndex + rowSpanData.count;
            startIndexList.push(spannedIndex);
        } else {
            spannedIndex = startIndex + rowSpanData.count - 1;
            if (spannedIndex > endIndex) {
                endIndexList.push(spannedIndex);
            }
        }
    },

    /**
     * row end index 기준으로 rowspan 을 확인하며 endRangeList 를 업데이트 하는 함수
     * @param {object} param - parameters
     * @private
     */
    _concatRowSpanIndexFromEnd: function(param) {
        var endIndex = param.endIndex;
        var columnName = param.columnName;
        var rowSpanData = param.endRowSpanDataMap && param.endRowSpanDataMap[columnName];
        var endIndexList = param.endIndexList;
        var dataModel = param.dataModel;
        var spannedIndex, tmpRowSpanData;

        if (!rowSpanData) {
            return;
        }

        if (!rowSpanData.isMainRow) {
            spannedIndex = endIndex + rowSpanData.count;
            tmpRowSpanData = dataModel.at(spannedIndex).getRowSpanData(columnName);
            spannedIndex += tmpRowSpanData.count - 1;
            if (spannedIndex > endIndex) {
                endIndexList.push(spannedIndex);
            }
        } else {
            spannedIndex = endIndex + rowSpanData.count - 1;
            endIndexList.push(spannedIndex);
        }
    },

    /**
     * rowSpan 된 Index range 를 반환한다.
     * @param {{row: Array, column: Array}} spannedRange 인덱스 정보
     * @returns {{row: Array, column: Array}} New Range
     * @private
     */
    _getRowSpannedIndex: function(spannedRange) {
        var columnModelList = this.columnModel.getVisibleColumnModelList()
            .slice(spannedRange.column[0], spannedRange.column[1] + 1);
        var dataModel = this.dataModel;
        var startIndexList = [spannedRange.row[0]];
        var endIndexList = [spannedRange.row[1]];
        var startRow = dataModel.at(spannedRange.row[0]);
        var endRow = dataModel.at(spannedRange.row[1]);
        var newSpannedRange = $.extend({}, spannedRange);
        var startRowSpanDataMap, endRowSpanDataMap, columnName, param;

        if (!startRow || !endRow) {
            return newSpannedRange;
        }

        startRowSpanDataMap = dataModel.at(spannedRange.row[0]).getRowSpanData();
        endRowSpanDataMap = dataModel.at(spannedRange.row[1]).getRowSpanData();

        //모든 열을 순회하며 각 열마다 설정된 rowSpan 정보에 따라 인덱스를 업데이트 한다.
        _.each(columnModelList, function(columnModel) {
            columnName = columnModel.columnName;
            param = {
                columnName: columnName,
                startIndex: spannedRange.row[0],
                endIndex: spannedRange.row[1],
                endRowSpanDataMap: endRowSpanDataMap,
                startRowSpanDataMap: startRowSpanDataMap,
                startIndexList: startIndexList,
                endIndexList: endIndexList,
                dataModel: dataModel
            };
            this._concatRowSpanIndexFromStart(param);
            this._concatRowSpanIndexFromEnd(param);
        }, this);

        newSpannedRange.row = [Math.min.apply(null, startIndexList), Math.max.apply(null, endIndexList)];
        return newSpannedRange;
    }
});

module.exports = Selection;
