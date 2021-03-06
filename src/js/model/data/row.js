/**
 * @fileoverview Grid 의 Data Source 에 해당하는 Model 정의
 * @author NHN Ent. FE Development Team
 */
'use strict';

var Model = require('../../base/model');
var ExtraDataManager = require('./extraDataManager');
var util = require('../../common/util');
var classNameConst = require('../../common/classNameConst');

// Propertie names that indicate meta data
var PRIVATE_PROPERTIES = [
    '_button',
    '_number',
    '_extraData'
];

// Error code for validtaion
var VALID_ERR_REQUIRED = 'REQUIRED';

/**
 * Data 중 각 행의 데이터 모델 (DataSource)
 * @module model/data/row
 * @extends module:base/model
 */
var Row = Model.extend(/**@lends module:model/data/row.prototype */{
    /**
     * @constructs
     */
    initialize: function() {
        Model.prototype.initialize.apply(this, arguments);
        this.extraDataManager = new ExtraDataManager(this.get('_extraData'));

        this.columnModel = this.collection.columnModel;
        this.validateMap = {};
        this.on('change', this._onChange, this);
    },

    idAttribute: 'rowKey',

    /**
     * Overrides Backbone's parse method for extraData not to be null.
     * @override
     * @param  {object} data - initial data
     * @returns {object} - parsed data
     */
    parse: function(data) {
        if (!data._extraData) {
            data._extraData = {};
        }
        return data;
    },

    /**
     * Event handler for change event in _extraData.
     * Reset _extraData value with cloned object to trigger 'change:_extraData' event.
     * @private
     */
    _triggerExtraDataChangeEvent: function() {
        this.trigger('extraDataChanged', this.get('_extraData'));
    },

    /**
     * Event handler for 'change' event.
     * Executes callback functions, sync rowspan data, and validate data.
     * @private
     */
    _onChange: function() {
        var publicChanged = _.omit(this.changed, PRIVATE_PROPERTIES);

        if (this.isDuplicatedPublicChanged(publicChanged)) {
            return;
        }
        _.each(publicChanged, function(value, columnName) {
            var columnModel = this.columnModel.getColumnModel(columnName);
            if (!columnModel) {
                return;
            }
            if (!this._executeChangeBeforeCallback(columnName)) {
                return;
            }
            this.collection.syncRowSpannedData(this, columnName, value);
            this._executeChangeAfterCallback(columnName);
            this.validateCell(columnName, true);
        }, this);
    },

    /**
     * Validate the cell data of given columnName and returns the error code.
     * @param  {Object} columnName - Column name
     * @returns {String} Error code
     * @private
     */
    _validateCellData: function(columnName) {
        var columnModel = this.columnModel.getColumnModel(columnName),
            value = this.get(columnName),
            errorCode = '';

        if (columnModel.isRequired && util.isBlank(value)) {
            errorCode = VALID_ERR_REQUIRED;
        }
        return errorCode;
    },

    /**
     * Validate a cell of given columnName.
     * If the data is invalid, add 'invalid' class name to the cell.
     * @param {String} columnName - Target column name
     * @param {Boolean} isDataChanged - True if data is changed (called by onChange handler)
     * @returns {String} - Error code
     */
    validateCell: function(columnName, isDataChanged) {
        var errorCode;

        if (!isDataChanged && (columnName in this.validateMap)) {
            return this.validateMap[columnName];
        }

        errorCode = this._validateCellData(columnName);
        if (errorCode) {
            this.addCellClassName(columnName, classNameConst.CELL_INVALID);
        } else {
            this.removeCellClassName(columnName, classNameConst.CELL_INVALID);
        }
        this.validateMap[columnName] = errorCode;

        return errorCode;
    },

    /**
     * columnModel 에 정의된 changeCallback 을 수행할 때 전달핼 이벤트 객체를 생성한다.
     * @param {String} columnName 컬럼명
     * @returns {{rowKey: (number|string), columnName: string, columnData: *, instance: {object}}}
     *          changeCallback 에 전달될 이벤트 객체
     * @private
     */
    _createChangeCallbackEvent: function(columnName) {
        return {
            rowKey: this.get('rowKey'),
            columnName: columnName,
            value: this.get(columnName),
            instance: tui.Grid.getInstanceById(this.collection.gridId)
        };
    },

    /**
     * columnModel 에 정의된 changeBeforeCallback 을 수행한다.
     * changeBeforeCallback 의 결과가 false 일 때, 데이터를 복원후 false 를 반환한다.
     * @param {String} columnName   컬럼명
     * @returns {boolean} changeBeforeCallback 수행 결과값
     * @private
     */
    _executeChangeBeforeCallback: function(columnName) {
        var columnModel = this.columnModel.getColumnModel(columnName),
            changeEvent, obj;

        if (columnModel.editOption && columnModel.editOption.changeBeforeCallback) {
            changeEvent = this._createChangeCallbackEvent(columnName);

            if (columnModel.editOption.changeBeforeCallback(changeEvent) === false) {
                obj = {};
                obj[columnName] = this.previous(columnName);
                this.set(obj);
                this.trigger('restore', columnName);
                return false;
            }
        }
        return true;
    },

    /**
     * columnModel 에 정의된 changeAfterCallback 을 수행한다.
     * @param {String} columnName - 컬럼명
     * @returns {boolean} changeAfterCallback 수행 결과값
     * @private
     */
    _executeChangeAfterCallback: function(columnName) {
        var columnModel = this.columnModel.getColumnModel(columnName),
            changeEvent;

        if (columnModel.editOption && columnModel.editOption.changeAfterCallback) {
            changeEvent = this._createChangeCallbackEvent(columnName);
            return !!(columnModel.editOption.changeAfterCallback(changeEvent));
        }
        return true;
    },

    /**
     * Returns the Array of private property names
     * @returns {array} An array of private property names
     */
    getPrivateProperties: function() {
        return PRIVATE_PROPERTIES;
    },

    /**
     * Returns the object that contains rowState info.
     * @returns {{isDisabled: boolean, isDisabledCheck: boolean, isChecked: boolean}} rowState 정보
     */
    getRowState: function() {
        return this.extraDataManager.getRowState();
    },

    /**
     * Returns an array of all className, related with given columnName.
     * @param {String} columnName - Column name
     * @returns {Array.<String>} - An array of classNames
     */
    getClassNameList: function(columnName) {
        var columnModel = this.columnModel.getColumnModel(columnName),
            isMetaColumn = util.isMetaColumn(columnName),
            classNameList = this.extraDataManager.getClassNameList(columnName),
            cellState = this.getCellState(columnName);

        if (columnModel.className) {
            classNameList.push(columnModel.className);
        }
        if (columnModel.isEllipsis) {
            classNameList.push(classNameConst.CELL_ELLIPSIS);
        }
        if (columnModel.isRequired) {
            classNameList.push(classNameConst.CELL_REQUIRED);
        }
        if (isMetaColumn) {
            classNameList.push(classNameConst.CELL_HEAD);
        } else if (cellState.isEditable) {
            classNameList.push(classNameConst.CELL_EDITABLE);
        }
        if (cellState.isDisabled) {
            classNameList.push(classNameConst.CELL_DISABLED);
        }

        return this._makeUniqueStringArray(classNameList);
    },

    /**
     * Returns a new array, which splits all comma-separated strings in the targetList and removes duplicated item.
     * @param  {Array} targetArray - Target array
     * @returns {Array} - New array
     */
    _makeUniqueStringArray: function(targetArray) {
        var singleStringArray = _.uniq(targetArray.join(' ').split(' '));
        return _.without(singleStringArray, '');
    },

    /**
     * Returns the state of the cell identified by a given column name.
     * @param {String} columnName - column name
     * @returns {{isEditable: boolean, isDisabled: boolean}}
     */
    getCellState: function(columnName) {
        var notEditableTypeList = ['_number', 'normal'],
            columnModel = this.columnModel,
            isDisabled = this.collection.isDisabled,
            isEditable = true,
            editType = columnModel.getEditType(columnName),
            rowState, relationResult;

        relationResult = this.executeRelationCallbacksAll(['isDisabled', 'isEditable'])[columnName];
        rowState = this.getRowState();

        if (!isDisabled) {
            if (columnName === '_button') {
                isDisabled = rowState.isDisabledCheck;
            } else {
                isDisabled = rowState.isDisabled;
            }
            isDisabled = isDisabled || !!(relationResult && relationResult.isDisabled);
        }

        if (_.contains(notEditableTypeList, editType)) {
            isEditable = false;
        } else {
            isEditable = !(relationResult && relationResult.isEditable === false);
        }

        return {
            isEditable: isEditable,
            isDisabled: isDisabled
        };
    },

    /**
     * Returns whether the cell identified by a given column name is editable.
     * @param {String} columnName - column name
     * @returns {Boolean}
     */
    isEditable: function(columnName) {
        var cellState = this.getCellState(columnName);

        return !cellState.isDisabled && cellState.isEditable;
    },

    /**
     * Returns whether the cell identified by a given column name is disabled.
     * @param {String} columnName - column name
     * @returns {Boolean}
     */
    isDisabled: function(columnName) {
        var cellState = this.getCellState(columnName);

        return cellState.isDisabled;
    },

    /**
     * getRowSpanData
     * rowSpan 설정값을 반환한다.
     * @param {String} [columnName] 인자가 존재하지 않을 경우, 행 전체의 rowSpanData 를 맵 형태로 반환한다.
     * @returns {*|{count: number, isMainRow: boolean, mainRowKey: *}}   rowSpan 설정값
     */
    getRowSpanData: function(columnName) {
        var isRowSpanEnable = this.collection.isRowSpanEnable(),
            rowKey = this.get('rowKey');

        return this.extraDataManager.getRowSpanData(columnName, rowKey, isRowSpanEnable);
    },

    /**
     * rowSpanData를 설정한다.
     * @param {string} columnName - 컬럼명
     * @param {object} data - rowSpan 정보를 가진 객체
     */
    setRowSpanData: function(columnName, data) {
        this.extraDataManager.setRowSpanData(columnName, data);
        this._triggerExtraDataChangeEvent();
    },

    /**
     * rowState 를 설정한다.
     * @param {string} rowState 해당 행의 상태값. 'DISABLED|DISABLED_CHECK|CHECKED' 중 하나를 설정한다.
     * @param {boolean} silent 내부 change 이벤트 발생 여부
     */
    setRowState: function(rowState, silent) {
        this.extraDataManager.setRowState(rowState);
        if (!silent) {
            this._triggerExtraDataChangeEvent();
        }
    },

    /**
     * rowKey 와 columnName 에 해당하는 Cell 에 CSS className 을 설정한다.
     * @param {String} columnName 컬럼 이름
     * @param {String} className 지정할 디자인 클래스명
     */
    addCellClassName: function(columnName, className) {
        this.extraDataManager.addCellClassName(columnName, className);
        this._triggerExtraDataChangeEvent();
    },

    /**
     * rowKey에 해당하는 행 전체에 CSS className 을 설정한다.
     * @param {String} className 지정할 디자인 클래스명
     */
    addClassName: function(className) {
        this.extraDataManager.addClassName(className);
        this._triggerExtraDataChangeEvent();
    },

    /**
     * rowKey 와 columnName 에 해당하는 Cell 에 CSS className 을 제거한다.
     * @param {String} columnName 컬럼 이름
     * @param {String} className 지정할 디자인 클래스명
     */
    removeCellClassName: function(columnName, className) {
        this.extraDataManager.removeCellClassName(columnName, className);
        this._triggerExtraDataChangeEvent();
    },

    /**
     * rowKey 에 해당하는 행 전체에 CSS className 을 제거한다.
     * @param {String} className 지정할 디자인 클래스명
     */
    removeClassName: function(className) {
        this.extraDataManager.removeClassName(className);
        this._triggerExtraDataChangeEvent();
    },

    /**
     * ctrl + c 로 복사 기능을 사용할 때 list 형태(select, button, checkbox)의 cell 의 경우, 해당 value 에 부합하는 text로 가공한다.
     * List type 의 경우 데이터 값과 editOption.list 의 text 값이 다르기 때문에
     * text 로 전환해서 반환할 때 처리를 하여 변환한다.
     *
     * @param {String} columnName   컬럼명
     * @returns {String} text 형태로 가공된 문자열
     * @private
     */
    _getListTypeVisibleText: function(columnName) {
        var value = this.get(columnName),
            columnModel = this.columnModel.getColumnModel(columnName),
            resultOptionList, editOptionList, typeExpected, valueList;

        if (tui.util.isExisty(tui.util.pick(columnModel, 'editOption', 'list'))) {
            resultOptionList = this.executeRelationCallbacksAll(['optionListChange'])[columnName];
            editOptionList = resultOptionList && resultOptionList.optionList ?
                    resultOptionList.optionList : columnModel.editOption.list;

            typeExpected = typeof editOptionList[0].value;
            valueList = util.toString(value).split(',');
            if (typeExpected !== typeof valueList[0]) {
                valueList = _.map(valueList, function(val) {
                    return util.convertValueType(val, typeExpected);
                });
            }
            _.each(valueList, function(val, index) {
                var item = _.findWhere(editOptionList, {value: val});
                valueList[index] = item && item.value || '';
            }, this);

            return valueList.join(',');
        }
        return '';
    },

    /**
     * Returns whether the given edit type is list type.
     * @param {String} editType - edit type
     * @returns {Boolean}
     * @private
     */
    _isListType: function(editType) {
        return _.contains(['select', 'radio', 'checkbox'], editType);
    },

    /**
     * change 이벤트 발생시 동일한 changed 객체의 public 프라퍼티가 동일한 경우 중복 처리를 막기 위해 사용한다.
     * 10ms 내에 같은 객체로 함수 호출이 일어나면 true를 반환한다.
     * @param {object} publicChanged 비교할 객체
     * @returns {boolean} 중복이면 true, 아니면 false
     */
    isDuplicatedPublicChanged: function(publicChanged) {
        if (this._timeoutIdForChanged && _.isEqual(this._lastPublicChanged, publicChanged)) {
            return true;
        }
        clearTimeout(this._timeoutIdForChanged);
        this._timeoutIdForChanged = setTimeout(_.bind(function() {
            this._timeoutIdForChanged = null;
        }, this), 10); // eslint-disable-line no-magic-numbers
        this._lastPublicChanged = publicChanged;

        return false;
    },

    /**
     * Returns the text string to be used when copying the cell value to clipboard.
     * @param {String} columnName - column name
     * @returns {String}
     */
    getValueString: function(columnName) {
        var editType = this.columnModel.getEditType(columnName);
        var column = this.columnModel.getColumnModel(columnName);
        var value = this.get(columnName);

        if (this._isListType(editType)) {
            if (tui.util.isExisty(tui.util.pick(column, 'editOption', 'list', 0, 'value'))) {
                value = this._getListTypeVisibleText(columnName);
            } else {
                throw this.error('Check "' + columnName + '"\'s editOption.list property out in your ColumnModel.');
            }
        } else if (editType === 'password') {
            value = '';
        }

        return util.toString(value);
    },

    /**
     * 컬럼모델에 정의된 relation 들을 수행한 결과를 반환한다. (기존 affectOption)
     * @param {Array} callbackNameList 반환값의 결과를 확인할 대상 callbackList.
     *        (default : ['optionListChange', 'isDisabled', 'isEditable'])
     * @returns {{}|{columnName: {attribute: *}}} row 의 columnName 에 적용될 속성값.
     */
    executeRelationCallbacksAll: function(callbackNameList) {
        var rowData = this.attributes,
            relationListMap = this.columnModel.get('relationListMap'),
            result = {};

        if (_.isEmpty(callbackNameList)) {
            callbackNameList = ['optionListChange', 'isDisabled', 'isEditable'];
        }

        _.each(relationListMap, function(relationList, columnName) {
            var value = rowData[columnName];

            _.each(relationList, function(relation) {
                this._executeRelationCallback(relation, callbackNameList, value, rowData, result);
            }, this);
        }, this);

        return result;
    },

    /**
     * Returns a name of attribute matching given callbackName.
     * @param {string} callbackName - callback name
     * @private
     * @returns {string}
     */
    _getRelationResultAttrName: function(callbackName) {
        switch (callbackName) {
            case 'optionListChange':
                return 'optionList';
            case 'isDisabled':
                return 'isDisabled';
            case 'isEditable':
                return 'isEditable';
            default:
                return '';
        }
    },

    /**
     * Executes relation callback
     * @param {object} relation - relation object
     *   @param {array} relation.columnList - target column list
     *   @param {function} [relation.isDisabled] - callback function for isDisabled attribute
     *   @param {function} [relation.isEditable] - callback function for isDisabled attribute
     *   @param {function} [relation.optionListChange] - callback function for changing option list
     * @param {array} callbackNameList - an array of callback names
     * @param {(string|number)} value - cell value
     * @param {object} rowData - all value of the row
     * @param {object} result - object to store the result of callback functions
     * @private
     */
    _executeRelationCallback: function(relation, callbackNameList, value, rowData, result) {
        var rowState = this.getRowState(),
            targetColumnNames = relation.columnList;

        _.each(callbackNameList, function(callbackName) {
            var attrName, callback;

            if (!rowState.isDisabled || callbackName !== 'isDisabled') {
                callback = relation[callbackName];
                if (typeof callback === 'function') {
                    attrName = this._getRelationResultAttrName(callbackName);
                    if (attrName) {
                        _.each(targetColumnNames, function(targetColumnName) {
                            result[targetColumnName] = result[targetColumnName] || {};
                            result[targetColumnName][attrName] = callback(value, rowData);
                        }, this);
                    }
                }
            }
        }, this);
    }
}, {
    privateProperties: PRIVATE_PROPERTIES
});

module.exports = Row;
