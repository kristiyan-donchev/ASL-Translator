import * as tf from '@tensorflow/tfjs'
import * as knnClassifier from '@tensorflow-models/knn-classifier'
import { normalizeLandmarks } from './landmarkFeatures'
import type { Point } from './landmarkFeatures'

/**
 * A small, genuinely-trained on-device classifier: it uses MediaPipe's
 * pretrained hand-landmark model as a feature extractor (transfer-learning
 * style, the same pattern used by tools like Teachable Machine), then fits
 * a k-nearest-neighbors classifier over those landmark features from
 * examples the user records live in the Train panel. This lets the app
 * learn signs the geometric rule-based classifier can't reliably tell
 * apart (e.g. G/H/K/M/N/P/Q/T), or entirely custom words/phrases, in
 * roughly 5-10 seconds of recording per label.
 */
export class TrainableSignClassifier {
  private classifier = knnClassifier.create()

  addExample(lm: Point[], label: string): void {
    const features = normalizeLandmarks(lm)
    tf.tidy(() => {
      const tensor = tf.tensor1d(features)
      this.classifier.addExample(tensor, label)
    })
  }

  async predict(lm: Point[]): Promise<{ label: string; confidence: number } | null> {
    if (this.classifier.getNumClasses() === 0) return null
    const features = normalizeLandmarks(lm)
    const tensor = tf.tensor1d(features)
    try {
      const k = Math.min(10, this.totalExamples())
      const result = await this.classifier.predictClass(tensor, Math.max(1, k))
      return { label: result.label, confidence: result.confidences[result.label] ?? 0 }
    } finally {
      tensor.dispose()
    }
  }

  clearLabel(label: string): void {
    this.classifier.clearClass(label)
  }

  clearAll(): void {
    this.classifier.clearAllClasses()
  }

  getCounts(): Record<string, number> {
    return this.classifier.getClassExampleCount()
  }

  private totalExamples(): number {
    return Object.values(this.getCounts()).reduce((a, b) => a + b, 0)
  }
}
