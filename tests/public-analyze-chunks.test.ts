import test from 'node:test'
import assert from 'node:assert/strict'

import { reassembleChunkedUpload } from '../src/lib/chunk-upload.ts'

test('reassembleChunkedUpload rejects sparse or incomplete chunk arrays', () => {
  const sparse = Array<Buffer | undefined>(3)
  sparse[0] = Buffer.from('a')
  sparse[2] = Buffer.from('c')

  assert.equal(reassembleChunkedUpload(sparse, 3), null)
  assert.equal(reassembleChunkedUpload([Buffer.from('a'), Buffer.from('b')], 2).toString(), 'ab')
})
