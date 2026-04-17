import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownView({ content, className = '' }) {
  if (!content) return null
  return (
    <div className={`prose prose-sm md:prose-base max-w-none text-on-surface ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ node, ...props }) => (
            <img
              loading="lazy"
              className="rounded-md max-w-full h-auto my-4"
              {...props}
            />
          ),
          a: ({ node, ...props }) => (
            <a
              {...props}
              className="text-primary underline underline-offset-2 hover:text-primary/80"
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto">
              <table className="text-sm" {...props} />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
