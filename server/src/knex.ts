import knex, { Knex } from "knex";

const config: Knex.Config = {
  client: 'better-sqlite3',
  connection: {
    filename: './thebit.sqlite'
  },
};
export default knex(config);

