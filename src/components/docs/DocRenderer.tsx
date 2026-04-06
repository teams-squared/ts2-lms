import { compileMDX } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";

interface DocRendererProps {
  source: string;
}

export default async function DocRenderer({ source }: DocRendererProps) {
  let content: React.ReactElement;
  try {
    ({ content } = await compileMDX({
      source,
      options: {
        mdxOptions: {
          remarkPlugins: [remarkGfm],
          rehypePlugins: [rehypeSlug, rehypeAutolinkHeadings, rehypeHighlight],
        },
      },
    }));
  } catch (err) {
    console.error("MDX compilation failed:", err);
    return (
      <p className="text-red-600 text-sm">
        This document could not be rendered. Please contact an administrator.
      </p>
    );
  }

  return <>{content}</>;
}
