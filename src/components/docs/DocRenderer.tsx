import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";

interface DocRendererProps {
  source: string;
}

export default async function DocRenderer({ source }: DocRendererProps) {
  const { content } = await compileMDX({
    source,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings, rehypeHighlight],
      },
    },
  });

  return <>{content}</>;
}
