import { Races, ElementDemons } from '../constants';
import { FissionTable, FusionTable, ElementTable, FissionRow, FusionRow } from '../../compendium/models';
import { SmtFusionChart } from '../../compendium/models/smt-fusion-chart';

import * as FUSION_CHART_JSON from '../data/fusion-chart.json';
import * as ELEMENT_CHART_JSON from '../data/element-chart.json';

export class FusionChart extends SmtFusionChart {
  races: string[];
  elementDemons = ElementDemons;
  lvlModifier = 2.5;

  protected fissionChart: FissionTable;
  protected fusionChart: FusionTable;
  protected elementChart: ElementTable;

  constructor() {
    super();
    this.initCharts();
  }

  initCharts() {
    const races: string[] = FUSION_CHART_JSON['races'];
    const elems: string[] = ELEMENT_CHART_JSON['elems'];
    const table: string[][] = FUSION_CHART_JSON['table'];
    const elemRaces: string[] = ELEMENT_CHART_JSON['races'];
    const elemTable: number[][] = ELEMENT_CHART_JSON['table'];

    this.races = races;
    this.fusionChart = SmtFusionChart.loadFusionTableJson(races, table);
    this.fissionChart = SmtFusionChart.loadFissionTableJson(races, elems, table);
    this.elementChart = SmtFusionChart.loadElementTableJson(elemRaces, elems, elemTable);
  }

  getLightDark(race: string): number {
    return 0;
  }

  getRaceFusions(race: string): FusionRow {
    const combos = Object.assign({}, super.getRaceFusions(race));
    return combos;
  }
}
