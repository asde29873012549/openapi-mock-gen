const { faker } = require('@faker-js/faker');

module.exports = {
  fakerMap: {
    overrideType: 'Overrided',
    overrideFormat: 'Overrided',
    overrideHeuristic_street: 'Overrided',
    overrideExample: 'Overrided',
    overrideWithFaker: () => faker.number.int({ min: 1, max: 5, multipleOf: 1 }),
    overrideWithFakerString: 'faker.number.int({ min: 1, max: 5, multipleOf: 1 })',
    overrideWithFunction: () => 'Overrided',
    overrideWithComplexFunction: () => {
      const random = Math.random();
      return random > 0.5 ? 'Overrided' : 'Overrided Also';
    },
    '(?:^|_)user(?:_|$)': 'Overrided',
  },
};
