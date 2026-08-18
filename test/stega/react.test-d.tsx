/**
 * Branded stega strings are intentionally assignable to `string`, so rendering them as JSX text
 * nodes keeps working, that's where stega-encoded data is meant to end up.
 * These tests pin that behavior against the real `@types/react` typings.
 */
import {stegaBrand, stegaClean, type StegaString} from '@sanity/client/stega'
import type {ReactNode} from 'react'
import {describe, expectTypeOf, test} from 'vitest'

const post = stegaBrand({
  title: 'foo',
  imageLocation: 'left' as 'left' | 'right',
})

describe('branded strings in JSX', () => {
  test('branded strings are assignable to ReactNode', () => {
    expectTypeOf(post.title).toExtend<ReactNode>()
    expectTypeOf<StegaString<'left' | 'right'>>().toExtend<ReactNode>()
  })

  test('rendering branded strings as text nodes is allowed', () => {
    const heading = <h1>{post.title}</h1>
    const fragment = (
      <>
        {post.title}
        <div title={post.title}>{post.imageLocation}</div>
      </>
    )
    expectTypeOf(heading).toExtend<ReactNode>()
    expectTypeOf(fragment).toExtend<ReactNode>()
  })

  test('passing branded strings to literal union props is a type error', () => {
    // @ts-expect-error -- not assignable to 'submit' | 'reset' | 'button'
    const button = <button type={post.imageLocation} />

    function Media(props: {align: 'left' | 'right'; children?: ReactNode}) {
      return <div>{props.children}</div>
    }
    // @ts-expect-error -- must be cleaned before it can be used as a literal union prop
    const media = <Media align={post.imageLocation}>{post.title}</Media>
    const cleaned = <Media align={stegaClean(post.imageLocation)}>{post.title}</Media>
    expectTypeOf(button).toExtend<ReactNode>()
    expectTypeOf(media).toExtend<ReactNode>()
    expectTypeOf(cleaned).toExtend<ReactNode>()
  })
})
