import { driver } from 'driver.js';
import "driver.js/dist/driver.css";

type StepItem = {
  // 引导元素
  element: string;
  popover: {
    // 标题
    title: string;
    // 描述
    description: string;
  }
  isShow?: boolean; // 是否展示引导，如果为 false，则不展示引导
}

type Data = Array<{
  // 当前引导的步骤
  steps: Array<StepItem>;
  // 当前引导的条件，成立则运行引导，否则进行下一个引导
  condition?: () => boolean;
  // 引导打开时调用
  onOpen?: () => void;
  id: String;
}>

/** 当前正在展示的 driver 实例与索引，防止重复调用导致多个引导同时打开 */
let activeDriver: ReturnType<typeof driver> | null = null;

/** 
 * ✅ 新增：在模块作用域保存最新的 data 
 * 这样即使 driverRender 被拦截，onDestroyed 也能拿到最新的数据
 */
let latestData: Data = [];

/**
 * 用于渲染引导
 * @param data 引导数据，数组结构，每一项为一个引导
 */
export default function driverRender(data: Data) {
  // ✅ 每次调用时，无论是否被拦截，都先更新最新的 data
  latestData = data;

  // 已有引导正在展示
  if (activeDriver) {
    return;
  }

  const renderGuide = (index: number) => {
    // ✅ 每次执行时，都从外部读取最新的 data
    const currentData = latestData;

    if (index >= currentData.length) {
      activeDriver = null;
      return;
    }

    const current = currentData[index];

    // 检查 condition，若不成立则跳过当前引导，渲染下一个
    if (current.condition && !current.condition()) {
      renderGuide(index + 1);
      return;
    }

    current?.onOpen?.();

    const driverObj = driver({
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      doneBtnText: '我知道了',
      showProgress: true,
      allowClose: false,
      progressText: '第 {{current}} 步，共 {{total}} 步',
      onDestroyed: () => {
        activeDriver = null;
        renderGuide(index + 1);
      },
      steps: current.steps.filter(step => step.isShow !== false) || [] // 过滤掉 isShow 为 false 的步骤,
    });
    activeDriver = driverObj;
    driverObj.drive();
  };

  renderGuide(0);
}
