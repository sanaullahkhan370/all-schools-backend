const mongoose = require('mongoose');
const { AsyncLocalStorage } = require('async_hooks');
const tenantStorage = new AsyncLocalStorage();
const modelSchemas = new Map();
const registerAllModels = (connection) => {
  for (const [name, schema] of modelSchemas.entries()) {
    if (!connection.models[name]) connection.model(name, schema);
  }
};
const currentConnection = () => {
  const store = tenantStorage.getStore();
  if (!store || !store.connection) return mongoose.connection;
  registerAllModels(store.connection);
  return store.connection;
};
const resolveModel = (name) => {
  const connection = currentConnection();
  if (connection.models[name]) return connection.models[name];
  const schema = modelSchemas.get(name);
  if (!schema) throw new Error(`Model schema is not registered: ${name}`);
  return connection.model(name, schema);
};
const createTenantModel = (name, schema) => {
  modelSchemas.set(name, schema);
  if (!mongoose.models[name]) mongoose.model(name, schema);
  const target = function TenantModelProxy() {};
  return new Proxy(target, {
    get(_target, property) {
      const model = resolveModel(name);
      const value = model[property];
      return typeof value === 'function' ? value.bind(model) : value;
    },
    set(_target, property, value) { resolveModel(name)[property] = value; return true; },
    construct(_target, args) { const Model = resolveModel(name); return new Model(...args); },
    apply(_target, thisArg, args) { return resolveModel(name).apply(thisArg, args); },
  });
};
const runWithTenant = (tenant, callback) => tenantStorage.run(tenant, callback);
const getTenant = () => tenantStorage.getStore();
module.exports = { createTenantModel, registerAllModels, runWithTenant, getTenant };
