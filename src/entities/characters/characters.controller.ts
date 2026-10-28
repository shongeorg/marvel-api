import { getEntity, listEntities } from "../../db/client";
import {
  parsePositiveInt,
  sendBadRequest,
  sendNotFound,
  sendOk,
  sendServerError,
} from "../../shared/http";
import { buildPage, readPageParams, readSearch } from "../../shared/pagination";

export async function listCharacters(url: URL): Promise<Response> {
  const params = readPageParams(url);
  if (!params.ok) return sendBadRequest(params.message);

  try {
    const { results, total } = await listEntities({
      kind: "characters",
      page: params.page,
      limit: params.limit,
      search: readSearch(url),
    });

    return sendOk(buildPage("characters", results, params.page, params.limit, total));
  } catch {
    return sendServerError();
  }
}

export async function getCharacter(rawId: string): Promise<Response> {
  const id = parsePositiveInt(rawId, null);
  if (id === null) {
    return sendBadRequest('Path parameter "id" must be a positive integer');
  }

  try {
    const character = await getEntity("characters", id);
    if (character === null) {
      return sendNotFound(`Character with id ${id} was not found`);
    }

    return sendOk({ results: [character] });
  } catch {
    return sendServerError();
  }
}
