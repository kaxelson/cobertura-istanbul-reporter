'use strict';

/* globals describe, it, beforeEach, before, after */
const fs = require('fs');
const path = require('path');
const FileWriter = require('istanbul-lib-report/lib/file-writer');
const istanbulLibReport = require('istanbul-lib-report');
const istanbulLibCoverage = require('istanbul-lib-coverage');
const CoberturaReport = require('../index');
const xml = require('fast-xml-parser');

const expect = require('chai').expect;

describe('TextReport', () => {
    function createTest(file) {
        const fixture = require(path.resolve(
            __dirname,
            './fixtures/specs/' + file
        ));
        it(fixture.title, function () {
            const context = istanbulLibReport.createContext({
                dir: './',
                coverageMap: istanbulLibCoverage.createCoverageMap(fixture.map)
            });
            const tree = context.getTree('pkg');
            const opts = fixture.opts || {}
            opts.file = `cobertura-coverage_${file}.xml`
            const report = new CoberturaReport(opts);
            tree.visit(report, context);
            const output = fs.readFileSync(opts.file).toString()
            const cobertura = xml.parse(output, {ignoreAttributes: false})
            expect(cobertura.coverage.packages.class).to.be.undefined
            expect(cobertura.coverage.packages.package).to.not.be.undefined
        });
    }

    fs.readdirSync(path.resolve(__dirname, './fixtures/specs')).forEach(
        file => {
            if (file.indexOf('.json') !== -1) {
                createTest(file);
            }
        }
    );

    it('merged-maps', function () {
        const coverageMap = istanbulLibCoverage.createCoverageMap({})
        fs.readdirSync(path.resolve(__dirname, './fixtures/specs')).forEach(
            file => {
                if (file.indexOf('.json') !== -1) {
                    const fixture = require(path.resolve(
                        __dirname,
                        './fixtures/specs/' + file
                    ));
                    coverageMap.merge(fixture.map)
                }
            }
        );
        const context = istanbulLibReport.createContext({
            dir: './',
            coverageMap
        });
        const tree = context.getTree('pkg');
        const opts = {
            file: `cobertura-coverage_merged-maps.xml`,
            projectRoot: '/'
        }
        const report = new CoberturaReport(opts);
        tree.visit(report, context);
        const output = fs.readFileSync(opts.file).toString()
        const cobertura = xml.parse(output, {ignoreAttributes: false})
        expect(cobertura.coverage.packages.class).to.be.undefined
        expect(cobertura.coverage.packages.package).to.not.be.undefined
    })
});
