import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

const PATH_BY_COLLECTION = {
  korea: '/korea/',
  recipes: '/recipes/',
  entertainment: '/entertainment/',
  beauty: '/beauty/',
};

export async function GET(context) {
  const collections = await Promise.all(
    Object.keys(PATH_BY_COLLECTION).map((name) => getCollection(name, ({ data }) => data.draft !== true))
  );

  const items = collections
    .flatMap((posts, i) => {
      const basePath = PATH_BY_COLLECTION[Object.keys(PATH_BY_COLLECTION)[i]];
      return posts.map((post) => ({
        title: post.data.title,
        description: post.data.description,
        pubDate: post.data.pubDate,
        link: `${basePath}${post.slug}/`,
      }));
    })
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

  return rss({
    title: 'Korea Explained',
    description: 'Korea, Explained in culture, food, entertainment, and beauty.',
    site: context.site,
    items,
  });
}
