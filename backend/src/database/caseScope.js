import { AsyncLocalStorage } from 'node:async_hooks';

// The case a request (or a seed pass) is working on. Set once by the /cases/:caseId route guard,
// read by the models, so services never have to thread a case id through every call.
const scope = new AsyncLocalStorage();

export const inCase = (caseId, fn) => scope.run(caseId, fn);

export function currentCase() {
  const id = scope.getStore();
  if (!id) throw new Error('No case in scope: wrap the call in inCase(caseId, ...)');
  return id;
}
