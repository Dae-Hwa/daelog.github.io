const path = require('path');
const slash = require('slash');
const {kebabCase, uniq, get, compact, times} = require('lodash');
const {DATE_FORMAT, POSTS_PER_PAGE} = require('./src/common/consts');
// 어디에 쓰이던건지 확인 필요
// const {Interface} = require('readline');

// Don't forget to update hard code values into:
// - `templates/blog-page.tsx:23`
// - `pages/blog.tsx:26`
// - `pages/blog.tsx:121`
const cleanArray = cleanElement => compact(uniq(cleanElement));

// Create slugs for files.
// Slug will used for blog page path.
exports.onCreateNode = ({node, actions, getNode}) => {
  const {createNodeField} = actions;
  let slug;
  if (node.internal.type === 'MarkdownRemark') {
    const fileNode = getNode(node.parent);
    const [basePath, subPath, name] = fileNode.relativePath.split('/');
    slug = `/${basePath}/${subPath}/${name}/`;
  }

  if (slug) {
    // eslint-disable-next-line quotes
    createNodeField({node, name: `slug`, value: slug});
  }
};

// Implement the Gatsby API `createPages`.
// This is called after the Gatsby bootstrap is finished
// so you have access to any information necessary to
// programmatically create pages.
exports.createPages = ({graphql, actions}) => {
  const {createPage, createRedirect} = actions;

  const craeteCategory = function (posts, basePath) {
    const pageCount = Math.ceil(posts.length / POSTS_PER_PAGE);

    basePath.charAt(0) != "/" ? basePath = "/" + basePath : "";
    basePath.charAt(basePath.length - 1) == "/" ? basePath = basePath.substr(0, basePath.length - 1) : "";

    // Create tags pages
    posts
      .reduce(
        (mem, post) => cleanArray(mem.concat(get(post, 'frontmatter.tags'))),
        []
      )
      .forEach(tag => {
        createPage({
          path: `${basePath}/tags/${kebabCase(tag)}/`,
          // 주소 정리 필요
          // component: slash(templates.tagsPage),
          component: slash(path.resolve('src/templates/blog-list.tsx')),
          context: {
            dateFormat: DATE_FORMAT,
            postsPerPage: POSTS_PER_PAGE,
            filter: {
              frontmatter: {
                draft: {ne: true},
                tags: {in: [tag]}
              },
              fileAbsolutePath: {regex: `${basePath}/`}
            }
          }
        });
        times(pageCount, index => {
          createPage({
            path: `${basePath}/tags/${kebabCase(tag)}/${index + 1}/`,
            // 주소 정리 필요
            // component: slash(templates.blogPage),
            component: slash(path.resolve('src/templates/blog-list.tsx')),
            context: {
              skip: index * POSTS_PER_PAGE,
              dateFormat: DATE_FORMAT,
              postsPerPage: POSTS_PER_PAGE,
              filter: {
                frontmatter: {
                  draft: {ne: true},
                  tags: {in: [tag]}
                },
                fileAbsolutePath: {regex: `${basePath}/`}
              }
            }
          });
        });
      });

    // Create blog pagination
    times(pageCount, index => {
      createPage({
        path: `${basePath}/${index + 1}/`,
        // 주소 정리 필요
        // component: slash(templates.blogPage),
        component: slash(path.resolve('src/templates/blog-list.tsx')),
        context: {
          skip: index * POSTS_PER_PAGE,
          dateFormat: DATE_FORMAT,
          postsPerPage: POSTS_PER_PAGE,
          filter: {
            frontmatter: {
              draft: {ne: true}
            },
            fileAbsolutePath: {regex: `${basePath}/`}
          }
        }
      });
    });

    // Create default blog pages
    createPage({
      path: `${basePath}`,
      component: slash(path.resolve('src/templates/blog-list.tsx')),
      context: {
        dateFormat: DATE_FORMAT,
        postsPerPage: POSTS_PER_PAGE,
        filter: {
          frontmatter: {
            draft: {ne: true}
          },
          fileAbsolutePath: {regex: `${basePath}/`}
        }
      }
    });
  }

  return new Promise((resolve, reject) => {
    const templates = ['blogPost', 'tagsPage', 'blogPage'].reduce(
      (mem, templateName) => {
        return Object.assign({}, mem, {
          [templateName]: path.resolve(
            `src/templates/${kebabCase(templateName)}.tsx`
          )
        });
      },
      {}
    );

    graphql(
      `
        {
          posts: allMarkdownRemark {
            edges {
              node {
                fields {
                  slug
                }
                frontmatter {
                  tags
                }
              }
            }
          }
        }
      `
    ).then(result => {
      if (result.errors) {
        return reject(result.errors);
      }

      const posts = result.data.posts.edges.map(p => p.node);

      // Create blog pages
      posts
        .filter(post => post.fields.slug.startsWith('/blog/'))
        .forEach(post => {
          createPage({
            path: post.fields.slug,
            component: slash(templates.blogPost),
            context: {
              slug: post.fields.slug,
              dateFormat: DATE_FORMAT
            }
          });
        });


      craeteCategory(posts, "blog")
      craeteCategory(posts, "til")
      craeteCategory(posts, "post")
      craeteCategory(posts, "tip")

      // Redirect temporary
      createRedirect({
        fromPath: '/',
        toPath: '/blog/',
        redirectInBrowser: true,
        isPermanent: true
      });
      createRedirect({
        fromPath: '/about/',
        toPath: '/blog/',
        redirectInBrowser: true,
        isPermanent: true
      });

      resolve();
    });
  });
};

