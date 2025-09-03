import { MOCK_FAKER_DATA } from '../../tests/constants';

const actualFaker = jest.requireActual('@faker-js/faker');

export const faker: typeof actualFaker = {
  ...actualFaker,
  ...Object.fromEntries(
    Object.entries(MOCK_FAKER_DATA).map(([key, value]) => [
      key,
      Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jest.fn(v)])),
    ])
  ),
};

export default faker;
