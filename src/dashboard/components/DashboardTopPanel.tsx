import { EditableText } from "../../shared/components/EditableText";
import { Button, Typography, DatePicker, Form, Row, Col, Select, Tooltip } from "antd";
import { SyncOutlined, FullscreenOutlined, InfoCircleOutlined } from "@ant-design/icons";
import PipelineSetting from "./PipelineSetting";
import React, { FC, useEffect, useState } from "react";
import { css } from "@emotion/react";
import { PRIMARY_COLOR, SECONDARY_COLOR, GRAY_13 } from "../../shared/constants/styles";
import { useRequest } from "../../shared/hooks/useRequest";
import {
	getProjectDetailsUsingGet,
	updateBuildsUsingPost,
	updateProjectNameUsingPut,
	getPipelineStagesUsingGet,
	PipelineStagesResponse,
	getLastSynchronizationUsingGet,
} from "../../shared/clients/apis";
import moment from "moment";
import { dateFormatYYYYMMDD } from "../../shared/constants/date-format";
import { MultipleCascadeSelect } from "../../shared/components/MultipleCascadeSelect";
import { isEmpty, isEqual } from "lodash";
import { formatLastUpdateTime } from "../../shared/utils/timeFormats";
import { usePrevious } from "../../shared/hooks/usePrevious";
import { DurationUnit } from "../../shared/__types__/base";
import HintIcon from "../../shared/components/HintIcon";

const { Text } = Typography;
const { RangePicker } = DatePicker;

const containerStyles = css({
	padding: "29px 32px",
});

const headerStyles = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
});

const fullScreenStyles = css({
	backgroundColor: SECONDARY_COLOR,
	fontSize: 16,
	borderRadius: 4,
	padding: 10,
	marginLeft: 24,
	cursor: "pointer",
});

const fullScreenIconStyles = css({
	color: PRIMARY_COLOR,
});

const fullScreenTextStyles = css({ marginLeft: 10, color: PRIMARY_COLOR });

const pipelineSettingStyles = css({
	display: "inline-block",
	padding: "4px 24px 4px 0",
});

const transformPipelineStages = (data: typeof getPipelineStagesUsingGet.TResp = []) =>
	data.map((v: PipelineStagesResponse) => ({
		label: v.pipelineName,
		value: v.pipelineId,
		children: v.stages.map((stageName: string) => ({
			label: stageName,
			value: stageName,
		})),
	}));

export interface FormValues {
	duration: [moment.Moment, moment.Moment];
	pipelines: Array<{ value: string; childValue: string }>;
	unit: DurationUnit;
}

interface DashboardTopPanelProps {
	projectId: string;
	onApply: (formValues: FormValues) => void;
}

const INPUT_FIELD_EXPLANATIONS = {
	TIME_RANGE:
		"The start and end date of the pipeline data sampling where four key metrics is analysed.",
	SAMPLING_INTERVAL: "The data sampling interval for each displayed number.",
	PIPELINE_STAGE:
		"The configured pipeline(s) and their stages will be listed here.The four key metrics data will be analysed based on the selected ones only.",
};

const INPUT_FIELD_LABELS = {
	TIME_RANGE: "Time Range",
	SAMPLING_INTERVAL: "Sampling Interval",
	PIPELINE_STAGE: "Pipeline/Stage",
};

export const DashboardTopPanel: FC<DashboardTopPanelProps> = ({ projectId, onApply }) => {
	const defaultValues = {
		duration: [
			moment(new Date(), dateFormatYYYYMMDD).startOf("day"),
			moment(new Date(), dateFormatYYYYMMDD).endOf("day").subtract(4, "month"),
		] as any,
		unit: "Fortnightly",
		pipelines: [],
	} as FormValues;
	const [project, getProjectRequest] = useRequest(getProjectDetailsUsingGet);
	const [, updateBuildsRequest, syncing] = useRequest(updateBuildsUsingPost);
	const [, updateProjectNameRequest] = useRequest(updateProjectNameUsingPut);
	const [synchronization, getLastSynchronizationRequest] = useRequest(
		getLastSynchronizationUsingGet
	);
	const [pipelineStagesResp, getPipelineStagesRequest, , setPipelineStages] = useRequest(
		getPipelineStagesUsingGet
	);
	const pipelineStages = transformPipelineStages(pipelineStagesResp);

	const updateProjectName = async (name: string) => {
		await updateProjectNameRequest({
			projectId: projectId,
			requestBody: name,
		});
		getProject();
	};

	const getLastSyncTime = async () => {
		const resp = await getLastSynchronizationRequest({ projectId });
		if (!resp?.synchronizationTimestamp) {
			syncBuilds();
		}
	};

	const syncBuilds = async () => {
		await updateBuildsRequest({
			projectId,
		});

		getLastSyncTime();

		setPipelineStages([]);
		getPipelineStages();
	};

	const getProject = () => getProjectRequest({ projectId });

	const getPipelineStages = () => getPipelineStagesRequest({ projectId });

	useEffect(() => {
		getLastSyncTime();
		getPipelineStages();
		getProject();
	}, []);

	const [formValues, setFormValues] = useState<FormValues>(defaultValues);
	const prevPipelines = usePrevious(formValues.pipelines);
	const options = pipelineStages
		? pipelineStages.filter(v => !isEmpty(v.value) && !isEmpty(v?.children))
		: [];
	const prevOptions = usePrevious(options);

	useEffect(() => {
		if (isEmpty(formValues.pipelines)) {
			return;
		}

		if (
			(isEmpty(prevPipelines) && !isEmpty(formValues.pipelines)) ||
			(!isEmpty(options) && !isEqual(prevOptions, options))
		) {
			onApply && onApply(formValues);
		}
	}, [formValues.pipelines, options]);

	const lastUpdateTime = formatLastUpdateTime(synchronization?.synchronizationTimestamp);

	return (
		<div css={containerStyles}>
			<div css={headerStyles}>
				<div>
					{project?.name && (
						<EditableText defaultValue={project?.name ?? ""} onEditDone={updateProjectName} />
					)}
					{lastUpdateTime && <Text type={"secondary"}>Last updated : {lastUpdateTime}</Text>}
				</div>
				<div>
					<span css={pipelineSettingStyles}>
						<PipelineSetting dashboardId={projectId} syncBuild={syncBuilds} />
					</span>
					<Button type="primary" icon={<SyncOutlined />} loading={syncing} onClick={syncBuilds}>
						{syncing ? "Synchronizing" : "Sync Data"}
					</Button>
					<span css={fullScreenStyles}>
						<FullscreenOutlined css={fullScreenIconStyles} />
						<Text css={fullScreenTextStyles}>Full Screen</Text>
					</span>
				</div>
			</div>
			<div css={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<Form
					layout={"vertical"}
					css={{ marginTop: 16 }}
					initialValues={defaultValues}
					onFinish={() => {
						if (isEmpty(formValues.pipelines)) {
							return;
						}
						onApply && onApply(formValues);
					}}
					onValuesChange={(_, values) => setFormValues(values)}>
					<Row wrap={false} gutter={16} align={"bottom"}>
						<Col>
							<Form.Item
								label={
									<HintIcon
										text={INPUT_FIELD_LABELS.TIME_RANGE}
										tooltip={INPUT_FIELD_EXPLANATIONS.TIME_RANGE}
									/>
								}
								name="duration">
								<RangePicker format={dateFormatYYYYMMDD} clearIcon={false} />
							</Form.Item>
						</Col>
						<Col>
							<Form.Item
								label={
									<HintIcon
										text={INPUT_FIELD_LABELS.SAMPLING_INTERVAL}
										tooltip={INPUT_FIELD_EXPLANATIONS.SAMPLING_INTERVAL}
									/>
								}
								name="unit">
								<Select>
									<Select.Option value="Fortnightly">Fortnightly</Select.Option>
									<Select.Option value="Monthly">Monthly</Select.Option>
								</Select>
							</Form.Item>
						</Col>
						<Col style={{ maxWidth: 522 }}>
							<Form.Item
								label={
									<HintIcon
										text={INPUT_FIELD_LABELS.PIPELINE_STAGE}
										tooltip={INPUT_FIELD_EXPLANATIONS.PIPELINE_STAGE}
									/>
								}
								name="pipelines">
								<MultipleCascadeSelect
									options={options}
									defaultValues={
										!isEmpty(options[0]?.children)
											? [
													{
														value: formValues.pipelines[0]?.value || options[0]?.value,
														childValue:
															formValues.pipelines[0]?.childValue ||
															(options[0]?.children ?? [])[0]?.label,
													},
											  ]
											: []
									}
								/>
							</Form.Item>
						</Col>
						<Col style={{ textAlign: "right" }}>
							<Form.Item css={{ marginTop: 40 }}>
								<Button htmlType="submit" disabled={syncing || isEmpty(options)}>
									Apply
								</Button>
							</Form.Item>
						</Col>
					</Row>
				</Form>
			</div>
		</div>
	);
};
