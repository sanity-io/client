const BASE_URL = 'https://www.sanity.io/help/'

export default function generateHelpUrl(slug: string) {
  return BASE_URL + slug
}
