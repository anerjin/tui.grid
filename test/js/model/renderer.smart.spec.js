'use strict';

var ColumnModelData = require('model/data/columnModel');
var RowListData = require('model/data/rowList');
var Dimension = require('model/dimension');
var Focus = require('model/focus');
var SmartRenderer = require('model/renderer-smart');
var DomState = require('domState');
var util = require('common/util');

describe('model.renderer', function() {
    var columnModelList = [
        {columnName: 'c1'},
        {columnName: 'c2'},
        {columnName: 'c3'}
    ];
    var sampleRow = {
        _extraData: {
            rowSpan: {
                c1: 3
            }
        },
        c1: '1',
        c2: '2',
        c3: '3'
    };

    var rowList = [],
        columnModel,
        dataModel,
        renderer,
        dimensionModel,
        focusModel,
        grid = {};

    (function setSampleRows() {
        var i;
        for (i = 0; i < 100; i += 1) {
            rowList.push($.extend({}, sampleRow));
        }
    })();

    beforeEach(function() {
        columnModel = new ColumnModelData();
        columnModel.set('columnModelList', columnModelList);
        dataModel = new RowListData([], {
            columnModel: columnModel
        });
        dimensionModel = new Dimension({
            offsetLeft: 100,
            offsetTop: 200,
            width: 500,
            height: 500,
            headerHeight: 150,
            rowHeight: 10,
            displayRowCount: 20,
            scrollX: true,
            scrollBarSize: 17,
            minimumColumnWidth: 20
        }, {
            dataModel: dataModel,
            columnModel: columnModel
        });
        focusModel = new Focus(null, {
            domState: new DomState($('<div />')),
            columnModel: columnModel,
            dataModel: dataModel,
            dimensionModel: dimensionModel
        });
        dataModel.reset(rowList, {parse: true});
        renderer = new SmartRenderer(null, {
            dataModel: dataModel,
            columnModel: columnModel,
            dimensionModel: dimensionModel,
            focusModel: focusModel
        });
        renderer.refresh();
    });

    describe('_setRenderingRange()', function() {
        it('when scrollTop = 0', function() {
            renderer._setRenderingRange(0);
            expect(renderer.get('top')).toBe(0);
            expect(renderer.get('startIndex')).toBe(0);
            expect(renderer.get('endIndex')).toBe(40);
        });

        it('when scrollTop = 100', function() {
            renderer._setRenderingRange(100);
            expect(renderer.get('top')).toBe(0);
            expect(renderer.get('startIndex')).toBe(0);
            expect(renderer.get('endIndex')).toBe(40);
        });

        it('when scrollTop = 200', function() {
            renderer._setRenderingRange(200);
            expect(renderer.get('top')).toBe(77);
            expect(renderer.get('startIndex')).toBe(7);
            expect(renderer.get('endIndex')).toBe(49);
        });

        it('when scrollTop = 300', function() {
            renderer._setRenderingRange(300);
            expect(renderer.get('top')).toBe(176);
            expect(renderer.get('startIndex')).toBe(16);
            expect(renderer.get('endIndex')).toBe(58);
        });

        it('when scrollTop = 400', function() {
            renderer._setRenderingRange(400);
            expect(renderer.get('top')).toBe(275);
            expect(renderer.get('startIndex')).toBe(25);
            expect(renderer.get('endIndex')).toBe(67);
        });
    });

    describe('_isRenderable()', function() {
        it('when scrollTop = 0', function() {
            renderer._setRenderingRange(0);
            expect(renderer._isRenderable(0)).toBe(false);
            expect(renderer._isRenderable(100)).toBe(false);
            expect(renderer._isRenderable(200)).toBe(true);
            expect(renderer._isRenderable(300)).toBe(true);
            expect(renderer._isRenderable(400)).toBe(true);
            expect(renderer._isRenderable(500)).toBe(true);
        });

        it('when scrollTop = 200', function() {
            renderer._setRenderingRange(200);
            expect(renderer._isRenderable(0)).toBe(true);
            expect(renderer._isRenderable(100)).toBe(false);
            expect(renderer._isRenderable(200)).toBe(false);
            expect(renderer._isRenderable(300)).toBe(true);
            expect(renderer._isRenderable(400)).toBe(true);
            expect(renderer._isRenderable(500)).toBe(true);
        });

        it('when scrollTop = 400', function() {
            renderer._setRenderingRange(400);
            expect(renderer._isRenderable(0)).toBe(true);
            expect(renderer._isRenderable(100)).toBe(true);
            expect(renderer._isRenderable(200)).toBe(true);
            expect(renderer._isRenderable(300)).toBe(false);
            expect(renderer._isRenderable(400)).toBe(false);
            expect(renderer._isRenderable(500)).toBe(true);
        });
    });

    describe('When dimension.bodyHeight is changed', function() {
        var proto;

        beforeEach(function() {
            renderer._setRenderingRange(0);
            proto = renderer.constructor.prototype;
            spyOn(proto, 'refresh');
        });

        it('refresh() method will be called if renderable', function() {
            dimensionModel.set('bodyHeight', 200);
            expect(proto.refresh).not.toHaveBeenCalled();

            dimensionModel.set('bodyHeight', 300);
            expect(proto.refresh).not.toHaveBeenCalled();

            dimensionModel.set('bodyHeight', 500);
            expect(proto.refresh).toHaveBeenCalled();
        });
    });
});
