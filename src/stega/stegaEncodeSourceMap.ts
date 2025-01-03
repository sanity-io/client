import {vercelStegaCombine} from '@vercel/stega'

import {createEditUrl} from '../csm/createEditUrl'
import {jsonPathToStudioPath} from '../csm/jsonPath'
import {resolveStudioBaseRoute} from '../csm/resolveEditInfo'
import {reKeySegment, toString as studioPathToString} from '../csm/studioPath'
import {encodeIntoResult} from './encodeIntoResult'
import {filterDefault} from './filterDefault'
import {
  type ContentSourceMap,
  type ContentSourceMapParsedPath,
  type InitializedStegaConfig,
} from './types'

const TRUNCATE_LENGTH = 20

/**
 * Uses `@vercel/stega` to embed edit info JSON into strings in your query result.
 * The JSON payloads are added using invisible characters so they don't show up visually.
 * The edit info is generated from the Content Source Map (CSM) that is returned from Sanity for the query.
 * @public
 */
export function stegaEncodeSourceMap<Result = unknown>(
  result: Result,
  resultSourceMap: ContentSourceMap | undefined,
  config: InitializedStegaConfig,
): Result {
  const {filter, logger, enabled} = config
  if (!enabled) {
    const msg = "config.enabled must be true, don't call this function otherwise"
    logger?.error?.(`[@sanity/client]: ${msg}`, {result, resultSourceMap, config})
    throw new TypeError(msg)
  }

  if (!resultSourceMap) {
    logger?.error?.('[@sanity/client]: Missing Content Source Map from response body', {
      result,
      resultSourceMap,
      config,
    })
    return result
  }

  if (!config.studioUrl) {
    const msg = 'config.studioUrl must be defined'
    logger?.error?.(`[@sanity/client]: ${msg}`, {result, resultSourceMap, config})
    throw new TypeError(msg)
  }

  const report: Record<'encoded' | 'skipped', {path: string; length: number; value: string}[]> = {
    encoded: [],
    skipped: [],
  }

  const resultWithStega = encodeIntoResult(
    result,
    resultSourceMap,
    ({sourcePath, sourceDocument, resultPath, value}) => {
      // Allow userland to control when to opt-out of encoding
      if (
        (typeof filter === 'function'
          ? filter({sourcePath, resultPath, filterDefault, sourceDocument, value})
          : filterDefault({sourcePath, resultPath, filterDefault, sourceDocument, value})) === false
      ) {
        if (logger) {
          report.skipped.push({
            path: prettyPathForLogging(sourcePath),
            value: `${value.slice(0, TRUNCATE_LENGTH)}${
              value.length > TRUNCATE_LENGTH ? '...' : ''
            }`,
            length: value.length,
          })
        }
        return value
      }

      if (logger) {
        report.encoded.push({
          path: prettyPathForLogging(sourcePath),
          value: `${value.slice(0, TRUNCATE_LENGTH)}${value.length > TRUNCATE_LENGTH ? '...' : ''}`,
          length: value.length,
        })
      }

      const {baseUrl, workspace, tool} = resolveStudioBaseRoute(
        typeof config.studioUrl === 'function'
          ? config.studioUrl(sourceDocument)
          : config.studioUrl!,
      )
      if (!baseUrl) return value
      const {_id: id, _type: type, _projectId: projectId, _dataset: dataset} = sourceDocument

      return vercelStegaCombine(
        value,
        {
          origin: 'sanity.io',
          href: createEditUrl({
            baseUrl,
            workspace,
            tool,
            id,
            type,
            path: sourcePath,
            ...(!config.omitCrossDatasetReferenceData && {dataset, projectId}),
          }),
        },
        // We use custom logic to determine if we should skip encoding
        false,
      )
    },
  )

  if (logger) {
    const isSkipping = report.skipped.length
    const isEncoding = report.encoded.length
    if (isSkipping || isEncoding) {
      ;(logger?.groupCollapsed || logger.log)?.('[@sanity/client]: Encoding source map into result')
      logger.log?.(
        `[@sanity/client]: Paths encoded: ${report.encoded.length}, skipped: ${report.skipped.length}`,
      )
    }
    if (report.encoded.length > 0) {
      logger?.log?.(`[@sanity/client]: Table of encoded paths`)
      ;(logger?.table || logger.log)?.(report.encoded)
    }
    if (report.skipped.length > 0) {
      const skipped = new Set<string>()
      for (const {path} of report.skipped) {
        skipped.add(path.replace(reKeySegment, '0').replace(/\[\d+\]/g, '[]'))
      }
      logger?.log?.(`[@sanity/client]: List of skipped paths`, [...skipped.values()])
    }

    if (isSkipping || isEncoding) {
      logger?.groupEnd?.()
    }
  }

  return resultWithStega
}

function prettyPathForLogging(path: ContentSourceMapParsedPath): string {
  return studioPathToString(jsonPathToStudioPath(path))
}
