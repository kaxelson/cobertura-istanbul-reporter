'use strict';

/*
 This code has been adapted from
 https://github.com/istanbuljs/istanbuljs/blob/4fd5114a0926d20e4e1e3055323c44281f0af6cd/packages/istanbul-reports/lib/cobertura/index.js
 */

const path = require('path');
const {escape} = require('html-escaper');
const {ReportBase} = require('istanbul-lib-report');

class CoberturaReport extends ReportBase {
    constructor(opts) {
        super();

        this.cw = null;
        this.xml = null;
        this.projectRoot = opts && opts.projectRoot || process.cwd();
        this.file = opts && opts.file || 'cobertura-coverage.xml';
        this.root = null;
        this.packageNodes = [];
        this.classNodes = [];
    }

    onStart(root, context) {
        this.cw = context.writer.writeFile(this.file);
        this.xml = context.getXMLWriter(this.cw);
        this.root = root
    }

    onEnd() {
        this.writeRootStats(this.root)
        this.packageNodes.forEach(pn => this.writePackage(pn))

        this.xml.closeAll();
        this.cw.close();
    }

    onSummary(node) {
        this.packageNodes.push(node)
    }

    onDetail(node) {
        this.classNodes.push(node)
    }

    writeRootStats(node) {
        const metrics = node.getCoverageSummary();
        this.cw.println('<?xml version="1.0" ?>');
        this.cw.println(
            '<!DOCTYPE coverage SYSTEM "http://cobertura.sourceforge.net/xml/coverage-04.dtd">'
        );
        this.xml.openTag('coverage', {
            'lines-valid': metrics.lines.total,
            'lines-covered': metrics.lines.covered,
            'line-rate': metrics.lines.pct / 100.0,
            'branches-valid': metrics.branches.total,
            'branches-covered': metrics.branches.covered,
            'branch-rate': metrics.branches.pct / 100.0,
            timestamp: Date.now().toString(),
            complexity: '0',
            version: '0.1'
        });
        this.xml.openTag('sources');
        this.xml.inlineTag('source', null, this.projectRoot);
        this.xml.closeTag('sources');
        this.xml.openTag('packages');
    }

    writePackage(node) {
        const metrics = node.getCoverageSummary(true);
        if (!metrics) {
            return;
        }
        this.xml.openTag('package', {
            name: escape(asJavaPackage(node)),
            'line-rate': metrics.lines.pct / 100.0,
            'branch-rate': metrics.branches.pct / 100.0
        });
        this.xml.openTag('classes');

        const classNodes = this.classNodes.filter(it => it.getParent() === node)

        classNodes.forEach(cn => this.writeClass(cn))

        this.xml.closeTag('classes');
        this.xml.closeTag('package');
    }

    writeClass(node) {
        const fileCoverage = node.getFileCoverage();
        const metrics = node.getCoverageSummary();
        const branchByLine = fileCoverage.getBranchCoverageByLine();

        this.xml.openTag('class', {
            name: escape(asClassName(node)),
            filename: path.relative(this.projectRoot, fileCoverage.path),
            'line-rate': metrics.lines.pct / 100.0,
            'branch-rate': metrics.branches.pct / 100.0
        });

        this.xml.openTag('methods');
        const fnMap = fileCoverage.fnMap;
        Object.entries(fnMap).forEach(([k, {name, decl}]) => {
            const hits = fileCoverage.f[k];
            this.xml.openTag('method', {
                name: escape(name),
                hits,
                signature: '()V' //fake out a no-args void return
            });
            this.xml.openTag('lines');
            //Add the function definition line and hits so that jenkins cobertura plugin records method hits
            this.xml.inlineTag('line', {
                number: decl.start.line,
                hits
            });
            this.xml.closeTag('lines');
            this.xml.closeTag('method');
        });
        this.xml.closeTag('methods');

        this.xml.openTag('lines');
        const lines = fileCoverage.getLineCoverage();
        Object.entries(lines).forEach(([k, hits]) => {
            const attrs = {
                number: k,
                hits,
                branch: 'false'
            };
            const branchDetail = branchByLine[k];

            if (branchDetail) {
                attrs.branch = true;
                attrs['condition-coverage'] =
                    branchDetail.coverage +
                    '% (' +
                    branchDetail.covered +
                    '/' +
                    branchDetail.total +
                    ')';
            }
            this.xml.inlineTag('line', attrs);
        });

        this.xml.closeTag('lines');
        this.xml.closeTag('class');
    }
}

function asJavaPackage(node) {
    return node
        .getRelativeName()
        .replace(/\//g, '.')
        .replace(/\\/g, '.')
        .replace(/\.$/, '');
}

function asClassName(node) {
    return node.getRelativeName().replace(/.*[\\/]/, '');
}

module.exports = CoberturaReport;