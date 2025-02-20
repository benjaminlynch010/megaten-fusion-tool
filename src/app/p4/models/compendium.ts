import { Demon as BaseDemon, Compendium as ICompendium, NamePair } from '../../compendium/models';
import { Demon, Skill, CompendiumConfig } from '../models';

export class Compendium implements ICompendium {
  private demons: { [name: string]: Demon };
  private enemies: { [name: string]: BaseDemon };
  private skills: { [name: string]: Skill };
  private specialRecipes: { [name: string]: string[] } = {};
  private invertedDemons: { [race: string]: { [lvl: number]: string } };
  private invertedSpecials: { [ingred: string]: string[] };

  private allIngredients: { [race: string]: number[] };
  private allResults: { [race: string]: number[] };
  private _allDemons: BaseDemon[];
  private _allSkills: Skill[];
  private _inheritTypes: { [code: number]: number[] };

  dlcDemons: { [name: string]: boolean } = {};

  constructor(private compConfig: CompendiumConfig, private gameAbbr: string) {
    this.initImportedData();
    this.updateDerivedData();
  }

  initImportedData() {
    const demons:   { [name: string]: Demon } = {};
    const enemies:  { [name: string]: BaseDemon } = {};
    const skills:   { [name: string]: Skill } = {};
    const specials: { [name: string]: string[] } = {};
    const inverses: { [race: string]: { [lvl: number]: string } } = {};
    const invertedSpecials: { [ingred: string]: string[] } = {};
    const inheritCodes: { [elem: string]: number; } = {};
    const inheritTypes: { [code: number]: number[]; } = {};
    const inheritThresh = this.compConfig.races.includes('World') ? 0 : 1;

    for (const [elem, ratios] of Object.entries(this.compConfig.inheritTypes)) {
      const code = parseInt(ratios.map(r => r <= inheritThresh ? '0' : '1').join(''), 2);
      inheritCodes[elem] = code;
      inheritTypes[code] = ratios;
    }

    for (const demonDataJson of this.compConfig.demonData[this.gameAbbr]) {
      for (const [name, json] of Object.entries(demonDataJson)) {
        demons[name] = {
          name,
          race:     json['race'],
          lvl:      json['lvl'],
          currLvl:  json['lvl'],
          cardLvl:  json['cardlvl'] || 0,
          price:    Math.pow(json['stats'].reduce((acc, stat) => stat + acc, 0), 2) + 2000,
          inherits: inheritCodes[json['inherits']],
          stats:    json['stats'],
          resists:  json['resists'].split('').map(char => this.compConfig.resistCodes[char]),
          skills:   json['skills'],
          fusion:   json['fusion'] || 'normal',
          prereq:   json['prereq'] || ''
        };
      }
    }

    for (const enemyDataJson of this.compConfig.enemyData[this.gameAbbr]) {
      for (const [name, enemy] of Object.entries(enemyDataJson)) {
        let drops = []
        
        if (enemy['material'] && enemy['material'] !== '-') {
          drops.push(enemy['material']);
        } if (enemy['gem'] && enemy['gem'] !== '-') {
          drops.push(enemy['gem']);
        } if (enemy['drops']) {
          drops = drops.concat(enemy['drops']);
        } if (!drops.length) {
          drops.push('-');
        }

        enemies[name] = {
          name,
          race:     enemy['race'],
          lvl:      enemy['lvl'],
          currLvl:  enemy['lvl'],
          price:    0,
          inherits: 0,
          stats:    enemy['stats'].slice(0, 2),
          estats:   enemy['stats'].slice(2),
          resists:  enemy['resists'].toLowerCase().split('').map(char => this.compConfig.resistCodes[char]),
          skills:   enemy['skills'].reduce((acc, s) => { acc[s] = 0; return acc; }, {}),
          fusion:   'normal',
          area:     enemy['area'],
          drop:     drops.join(', '),
          isEnemy:  true
        };
      }
    }

    for (const skillData of this.compConfig.skillData[this.gameAbbr]) {
      for (const [name, json] of Object.entries(skillData)) {
        skills[name] = {
          name,
          element:   json['element'],
          cost:      json['cost'] || 0,
          rank:      json['rank'] || 99,
          effect:    json['power'] ? json['power'] + ' power' + (json['effect'] ? ', ' + json['effect'] : '') : json['effect'],
          target:    json['target'] || 'Self',
          learnedBy: [],
          transfer:  [],
          level:     0
        };

        if (json['card']) {
          skills[name].transfer = json['card'].split(', ').map(d => ({ demon: d, level: demons[d] ? demons[d].cardLvl : -100 }));
        }
      }
    }

    for (const [name, json] of Object.entries(this.compConfig.specialRecipes[this.gameAbbr])) {
      const ingreds = <string[]>json;
      specials[name] = ingreds;
      demons[name].fusion = 'special';

      if (ingreds.length === 2) {
        for (const ingred of ingreds) {
          if (!invertedSpecials[ingred]) { invertedSpecials[ingred] = []; }
          invertedSpecials[ingred].push(name);
        }
      }
    }

    for (const race of this.compConfig.races) {
      inverses[race] = {};
    }

    for (const demon of Object.values(demons).sort((a, b) => a.lvl - b.lvl)) {
      if (demon.fusion !== 'party') {
        inverses[demon.race][demon.lvl] = demon.name;
      }

      for (const [skill, level] of Object.entries(demon.skills)) {
        skills[skill].learnedBy.push({ demon: demon.name, level });
      }
    }

    this.demons = demons;
    this.enemies = enemies;
    this.skills = skills;
    this.specialRecipes = specials;
    this.invertedDemons = inverses;
    this.invertedSpecials = invertedSpecials;
    this._inheritTypes = inheritTypes;
  }

  updateDerivedData() {
    const ingredients: { [race: string]: number[] } = {};
    const results:     { [race: string]: number[] } = {};
    const skills: Skill[] = [];

    for (const skill of Object.values(this.skills)) {
      if (skill.learnedBy.length < 1) {
        skill.rank = 99;
      } else {
        skills.push(skill);
      }
    }

    for (const race of this.compConfig.races) {
      ingredients[race] = [];
      results[race] = [];
    }

    for (const [name, demon] of Object.entries(this.demons)) {
      if (demon.fusion !== 'party') {
        ingredients[demon.race].push(demon.lvl);

        if (!this.specialRecipes.hasOwnProperty(name)) {
          results[demon.race].push(demon.lvl);
        }
      }
    }

    for (const race of this.compConfig.races) {
      ingredients[race].sort((a, b) => a - b);
      results[race].sort((a, b) => a - b);
    }

    const allies = Object.keys(this.demons).map(name => this.demons[name]);
    const enemies = Object.keys(this.enemies).map(name => this.enemies[name]);
    this._allDemons = enemies.concat(allies);
    this._allSkills = skills;
    this.allIngredients = ingredients;
    this.allResults = results;
  }

  get allDemons(): BaseDemon[] {
    return this._allDemons;
  }

  get allSkills(): Skill[] {
    return this._allSkills;
  }

  get specialDemons(): Demon[] {
    return Object.keys(this.specialRecipes).map(name => this.demons[name]);
  }

  get inheritHeaders(): string[] {
    return this.compConfig.inheritElems;
  }

  getDemon(name: string): BaseDemon {
    return this.demons[name] || this.enemies[name];
  }

  getSkill(name: string): Skill {
    return this.skills[name];
  }

  getSkills(names: string[]): Skill[] {
    const elemOrder = this.compConfig.elemOrder;
    const skills = names.map(name => this.skills[name]);
    skills.sort((d1, d2) => (elemOrder[d1.element] - elemOrder[d2.element]) * 10000 + d1.rank - d2.rank);
    return skills;
  }

  getIngredientDemonLvls(race: string): number[] {
    return this.allIngredients[race] || [];
  }

  getResultDemonLvls(race: string): number[] {
    return this.allResults[race] || [];
  }

  getSpecialNameEntries(name: string): string[] {
    return this.specialRecipes[name] || [];
  }

  getSpecialNamePairs(name: string): NamePair[] {
    return [];
  }

  getInheritElems(inheritType: number): number[] {
    return this._inheritTypes[inheritType];
  }

  reverseLookupDemon(race: string, lvl: number): string {
    return this.invertedDemons[race][lvl];
  }

  reverseLookupSpecial(ingredient: string): string[] {
    return this.invertedSpecials[ingredient] || [];
  }

  isElementDemon(name: string): boolean {
    return false;
  }
}
