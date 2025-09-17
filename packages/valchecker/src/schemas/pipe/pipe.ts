import type { DefineSchemaTypes, InferAsync, InferInput, InferOutput, InferTransformed, ValidationFailureResult, ValidationResult, ValSchema } from '../../core'
import type { Equal, ExecutionChain, IsPromise, MaybePromise } from '../../shared'
import type { PipeStepCheckSchemaMessage, RunCheck, RunCheckResult, RunCheckUtils, True } from './check'
import type { PipeStepFallbackSchemaMessage } from './fallback'
import type { PipeStepTransformSchemaMessage, RunTransform } from './transform'
import { AbstractSchema, implementSchemaClass } from '../../core'
import { createExecutionChain } from '../../shared'
import { PipeStepCheckSchema } from './check'
import { PipeStepFallbackSchema } from './fallback'
import { PipeStepTransformSchema } from './transform'

type PipeStepValSchema = ValSchema<ValidationResult<any>, any>
type PipeSteps = [ValSchema, ...PipeStepValSchema[]]

type NextAsync<NewValue extends boolean, LastValue extends boolean> = Equal<NewValue, false> extends true ? LastValue : true

type PipeSchemaTypes<Async extends boolean, Transformed extends boolean, Input, Output> = DefineSchemaTypes<{
	Async: Async
	Transformed: Transformed
	Meta: {
		steps: PipeSteps
	}
	Input: Input
	Output: Output
}>
class PipeSchema<Async extends boolean, Transformed extends boolean, Input, Output> extends AbstractSchema<PipeSchemaTypes<Async, Transformed, Input, Output>> {
	private '~step'(step: PipeStepValSchema): PipeSchema<any, any, any, any> {
		return new PipeSchema({
			meta: {
				steps: [...this.meta.steps, step],
			},
		})
	}

	/**
	 * Add a check step. (type guard)
	 */
	check<
		CheckOutput extends Output,
	>(
		rule: (value: NoInfer<Output>, utils: RunCheckUtils<NoInfer<Output>>) => value is CheckOutput,
		message?: PipeStepCheckSchemaMessage<Output, True<CheckOutput>>,
	): PipeSchema<Async, Transformed, Input, CheckOutput>
	/**
	 * Add a check step.
	 */
	check<
		Result extends RunCheckResult,
	>(
		rule: RunCheck<Output, Result>,
		message?: PipeStepCheckSchemaMessage<Output, Result>,
	): PipeSchema<NextAsync<Async, IsPromise<Result>>, Transformed, Input, Awaited<Result> extends (True<infer T> | false) ? T : Output>
	check(
		rule: RunCheck,
		message?: PipeStepCheckSchemaMessage<any, any>,
	): PipeSchema<any, any, any, any> {
		return this['~step'](new PipeStepCheckSchema({
			meta: { run: rule },
			message,
		}))
	}

	/**
	 * Add a transformation step.
	 */
	transform<
		Result extends MaybePromise<any>,
	>(
		rule: RunTransform<Output, Result>,
		message?: PipeStepTransformSchemaMessage<Output, Result>,
	): PipeSchema<NextAsync<Async, IsPromise<Result>>, true, Input, Awaited<Result>>
	transform(
		rule: RunTransform,
		message?: PipeStepTransformSchemaMessage<any, any>,
	): PipeSchema<any, any, any, any> {
		return this['~step'](new PipeStepTransformSchema({
			meta: { run: rule },
			message,
		}))
	}

	/**
	 * Add a fallback step.
	 */
	fallback<
		Result extends MaybePromise<Output>,
	>(
		rule: (failure: ValidationFailureResult) => Result,
		message?: PipeStepFallbackSchemaMessage<Output, IsPromise<Result>>,
	): PipeSchema<NextAsync<Async, IsPromise<Result>>, true, Input, Awaited<Result>> {
		return this['~step'](new PipeStepFallbackSchema({
			meta: { run: rule },
			message,
		}))
	}
}

implementSchemaClass(
	PipeSchema,
	{
		isTransformed: meta => meta.steps.some(step => step.isTransformed),
		validate: (value, { meta }) => {
			const [source, ...rest] = meta.steps
			let chain = createExecutionChain(source.validate(value)) as ExecutionChain<ValidationResult<any>>
			for (const step of rest) {
				chain = chain.then(result => step.validate(result))
			}
			return chain
		},
	},
)

function pipe<Source extends ValSchema>(source: Source): PipeSchema<InferAsync<Source>, InferTransformed<Source>, InferInput<Source>, InferOutput<Source>> {
	return new PipeSchema({ meta: { steps: [source] } })
}

export {
	pipe,
	PipeSchema,
}
