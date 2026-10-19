import manifest from 'virtual:release-manifest';
import MarkdownIt from 'markdown-it';
const markdown = new MarkdownIt({ html: false, linkify: false, breaks: false });
markdown.validateLink = url => /^https?:\/\//i.test(url);
markdown.renderer.rules.image = (tokens, index) => markdown.utils.escapeHtml(tokens[index].content);
const renderLink = markdown.renderer.rules.link_open || ((tokens, index, options, env, renderer) => renderer.renderToken(tokens, index, options));
markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
  tokens[index].attrSet('target', '_blank');
  tokens[index].attrSet('rel', 'noopener noreferrer');
  return renderLink(tokens, index, options, env, renderer);
};
export const releases = manifest.releases;
export const renderReleaseNotes = body => markdown.render(body);
