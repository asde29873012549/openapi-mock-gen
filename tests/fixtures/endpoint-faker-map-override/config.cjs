module.exports = {
  fakerMap: {
    username: 'faker.internet.userName()',
    email: 'faker.lorem.words()',
    role: () => 'guest',
    user_string: 'faker.person.fullName()',
  },
  endpoints: {
    '/user-profile': {
      get: {
        fakerMap: {
          id: () => Math.random().toString(36).substring(2, 15),
          username: 'faker.person.fullName()',
          role: () => 'admin',
          guest_array: 'faker.lorem.words()',
        },
      },
    },
  },
}; 