export default function QuestionMultiple({ question, answer, onChange, showResult }) {
  return (
    <div className="space-y-3">
      {question.options.map((opt, i) => {
        const isSelected = answer === i
        const isCorrect = question.correct === i

        let containerStyle
        let labelStyle

        if (showResult) {
          if (isCorrect) {
            containerStyle = 'border-primary bg-secondary-container/30 cursor-default'
            labelStyle = 'border-primary bg-primary text-on-primary'
          } else if (isSelected && !isCorrect) {
            containerStyle = 'border-error bg-error-container/20 cursor-default opacity-80'
            labelStyle = 'border-error bg-error text-on-error'
          } else {
            containerStyle = 'border-outline-variant/30 bg-surface-container-lowest cursor-default opacity-50'
            labelStyle = 'border-outline-variant text-outline'
          }
        } else if (isSelected) {
          containerStyle = 'border-primary bg-primary/5'
          labelStyle = 'border-primary bg-primary text-on-primary'
        } else {
          containerStyle = 'border-outline-variant/30 bg-surface-container-lowest hover:border-primary/40 hover:bg-primary/5'
          labelStyle = 'border-outline-variant text-outline'
        }

        return (
          <button
            key={i}
            disabled={showResult}
            onClick={() => onChange(i)}
            className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-150 ${containerStyle} flex items-start gap-3`}
          >
            <span className={`mt-0.5 w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-headline font-bold transition-all ${labelStyle}`}>
              {String.fromCharCode(65 + i)}
            </span>
            <span className="text-sm leading-relaxed text-on-surface pt-0.5">
              {opt.replace(/^[A-E]\.\s*/, '')}
            </span>
          </button>
        )
      })}
    </div>
  )
}
