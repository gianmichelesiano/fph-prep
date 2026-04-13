export default function QuestionTrueFalse({ question, answer, onChange, showResult }) {
  const answers = answer || {}

  function toggle(i, val) {
    if (showResult) return
    onChange({ ...answers, [i]: val })
  }

  return (
    <div className="space-y-3">
      {question.items.map((item, i) => {
        const selected = answers[i]
        const isCorrect = item.correct
        const userCorrect = showResult && selected === isCorrect

        return (
          <div
            key={i}
            className={`p-4 rounded-xl border-2 transition-all ${
              showResult
                ? userCorrect
                  ? 'border-primary/40 bg-secondary-container/20'
                  : 'border-error/40 bg-error-container/20'
                : 'border-outline-variant/30 bg-surface-container-lowest'
            }`}
          >
            <p className={`text-sm mb-3 leading-relaxed font-medium ${
              showResult
                ? userCorrect ? 'text-primary' : 'text-error'
                : 'text-on-surface'
            }`}>
              {item.text}
            </p>
            <div className="flex gap-2">
              {[true, false].map(val => {
                const isThisSelected = selected === val
                const isThisCorrect = showResult && val === isCorrect
                const isThisWrong = showResult && isThisSelected && val !== isCorrect

                return (
                  <button
                    key={String(val)}
                    disabled={showResult}
                    onClick={() => toggle(i, val)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-headline font-bold border-2 transition-all active:scale-95 ${
                      isThisCorrect
                        ? 'border-primary bg-primary text-on-primary'
                        : isThisWrong
                          ? 'border-error bg-error-container text-error'
                          : isThisSelected
                            ? 'border-primary bg-primary text-on-primary'
                            : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-primary/40 hover:text-primary'
                    }`}
                  >
                    {val ? 'Vero' : 'Falso'}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
