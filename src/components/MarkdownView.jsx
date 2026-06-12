import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Extract plain text from React children and slugify for heading anchors
function slugifyHeading(children) {
  const text = getTextContent(children)
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function getTextContent(node) {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (!node) return ''
  if (Array.isArray(node)) return node.map(getTextContent).join('')
  if (node.props?.children) return getTextContent(node.props.children)
  return ''
}

function headingRenderer(Tag) {
  return function HeadingComponent({ node, children, ...props }) {
    const slug = slugifyHeading(children)
    return (
      <Tag id={slug} className="group scroll-mt-20" {...props}>
        {children}
        {slug && (
          <a
            href={`#${slug}`}
            className="ml-2 no-underline opacity-0 group-hover:opacity-50 transition-opacity text-[0.7em] align-middle"
            aria-hidden="true"
          >
            #
          </a>
        )}
      </Tag>
    )
  }
}

export default function MarkdownView({ content, className = '' }) {
  if (!content) return null
  return (
    <div className={`prose prose-sm md:prose-base max-w-none text-on-surface ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: headingRenderer('h2'),
          h3: headingRenderer('h3'),
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
