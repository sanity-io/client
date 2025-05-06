/**
 * Inlined, modified version of the `codeFrameColumns` function from `@babel/code-frame`.
 * MIT-licensed - https://github.com/babel/babel/blob/main/LICENSE
 * Copyright (c) 2014-present Sebastian McKenzie and other contributors.
 */
type Location = {
  column: number
  line: number
}

type NodeLocation = {
  start: Location
  end?: Location
}

type GroqLocation = {
  start: number
  end?: number
}

/**
 * RegExp to test for newlines.
 */

const NEWLINE = /\r\n|[\n\r\u2028\u2029]/

/**
 * Extract what lines should be marked and highlighted.
 */

type MarkerLines = Record<number, true | [number, number]>

/**
 * Highlight a code frame with the given location and message.
 *
 * @param query - The query to be highlighted.
 * @param location - The location of the error in the code/query.
 * @param message - Message to be displayed inline (if possible) next to the highlighted
 * location in the code. If it can't be positioned inline, it will be placed above the
 * code frame.
 * @returns The highlighted code frame.
 */
export function codeFrame(query: string, location: GroqLocation, message?: string): string {
  const lines = query.split(NEWLINE)
  const loc = {
    start: columnToLine(location.start, lines),
    end: location.end ? columnToLine(location.end, lines) : undefined,
  }

  const {start, end, markerLines} = getMarkerLines(loc, lines)

  const numberMaxWidth = `${end}`.length

  return query
    .split(NEWLINE, end)
    .slice(start, end)
    .map((line, index) => {
      const number = start + 1 + index
      const paddedNumber = ` ${number}`.slice(-numberMaxWidth)
      const gutter = ` ${paddedNumber} |`
      const hasMarker = markerLines[number]
      const lastMarkerLine = !markerLines[number + 1]
      if (!hasMarker) {
        return ` ${gutter}${line.length > 0 ? ` ${line}` : ''}`
      }

      let markerLine = ''
      if (Array.isArray(hasMarker)) {
        const markerSpacing = line.slice(0, Math.max(hasMarker[0] - 1, 0)).replace(/[^\t]/g, ' ')
        const numberOfMarkers = hasMarker[1] || 1

        markerLine = [
          '\n ',
          gutter.replace(/\d/g, ' '),
          ' ',
          markerSpacing,
          '^'.repeat(numberOfMarkers),
        ].join('')

        if (lastMarkerLine && message) {
          markerLine += ' ' + message
        }
      }
      return ['>', gutter, line.length > 0 ? ` ${line}` : '', markerLine].join('')
    })
    .join('\n')
}

function getMarkerLines(
  loc: NodeLocation,
  source: Array<string>,
): {
  start: number
  end: number
  markerLines: MarkerLines
} {
  const startLoc: Location = {...loc.start}
  const endLoc: Location = {...startLoc, ...loc.end}
  const linesAbove = 2
  const linesBelow = 3
  const startLine = startLoc.line ?? -1
  const startColumn = startLoc.column ?? 0
  const endLine = endLoc.line
  const endColumn = endLoc.column

  let start = Math.max(startLine - (linesAbove + 1), 0)
  let end = Math.min(source.length, endLine + linesBelow)

  if (startLine === -1) {
    start = 0
  }

  if (endLine === -1) {
    end = source.length
  }

  const lineDiff = endLine - startLine
  const markerLines: MarkerLines = {}

  if (lineDiff) {
    for (let i = 0; i <= lineDiff; i++) {
      const lineNumber = i + startLine

      if (!startColumn) {
        markerLines[lineNumber] = true
      } else if (i === 0) {
        const sourceLength = source[lineNumber - 1].length

        markerLines[lineNumber] = [startColumn, sourceLength - startColumn + 1]
      } else if (i === lineDiff) {
        markerLines[lineNumber] = [0, endColumn]
      } else {
        const sourceLength = source[lineNumber - i].length

        markerLines[lineNumber] = [0, sourceLength]
      }
    }
  } else {
    if (startColumn === endColumn) {
      if (startColumn) {
        markerLines[startLine] = [startColumn, 0]
      } else {
        markerLines[startLine] = true
      }
    } else {
      markerLines[startLine] = [startColumn, endColumn - startColumn]
    }
  }

  return {start, end, markerLines}
}

function columnToLine(column: number, lines: string[]): Location {
  let offset = 0

  for (let i = 0; i < lines.length; i++) {
    const lineLength = lines[i].length + 1 // assume '\n' after each line

    if (offset + lineLength > column) {
      return {
        line: i + 1, // 1-based line
        column: column - offset, // 0-based column
      }
    }

    offset += lineLength
  }

  // Fallback: beyond last line
  return {
    line: lines.length,
    column: lines[lines.length - 1]?.length ?? 0,
  }
}
