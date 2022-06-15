package metrik.metrics.domain.calculator

import metrik.metrics.domain.model.LEVEL
import metrik.project.domain.model.Execution
import metrik.project.domain.model.Status
import org.springframework.stereotype.Component

@Component
class DeploymentFrequencyCalculator : MetricsCalculator {

    override fun calculateValue(
        allExecutions: List<Execution>,
        startTimestamp: Long,
        endTimestamp: Long,
        pipelineStagesMap: Map<String, String>
    ): Number {
        return pipelineStagesMap.map { entry ->
            allExecutions.filter {
                it.pipelineId == entry.key && !isInvalidBuild(
                    it,
                    startTimestamp,
                    endTimestamp,
                    entry.value
                )
            }.size
        }.sum()
    }

    override fun calculateLevel(value: Number, days: Int?): LEVEL {
        val deploymentCount = value.toDouble()

        val deploymentFrequency = deploymentCount / days!!

        return when {
            deploymentFrequency <= 1.0 / ONE_MONTH -> LEVEL.LOW
            deploymentFrequency <= 1.0 / ONE_WEEK -> LEVEL.MEDIUM
            deploymentFrequency <= 1.0 -> LEVEL.HIGH
            else -> LEVEL.ELITE
        }
    }

    private fun isInvalidBuild(
        currentExecution: Execution,
        startTimestamp: Long,
        endTimestamp: Long,
        targetStage: String
    ): Boolean {
        return !isTargetStageWithinTimeRange(currentExecution, startTimestamp, endTimestamp, targetStage) ||
            !isTargetStageSuccess(currentExecution, targetStage)
    }

    private fun isTargetStageSuccess(execution: Execution, targetStage: String) =
        !execution.stages.none { it.name == targetStage && it.status == Status.SUCCESS }

    private fun isTargetStageWithinTimeRange(
        execution: Execution,
        startTimestamp: Long,
        endTimestamp: Long,
        targetStage: String
    ): Boolean {
        val stage = execution.stages.find { it.name == targetStage }
        val deploymentFinishTimestamp = stage?.getStageDoneTime()

        return deploymentFinishTimestamp in startTimestamp..endTimestamp
    }

    companion object {
        private const val ONE_WEEK: Int = 7
        private const val ONE_MONTH: Int = 30
    }
}
