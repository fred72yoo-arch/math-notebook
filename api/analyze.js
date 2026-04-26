module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageBase64, mimeType, apiKey, mode, problemContext } = req.body;

  if (!apiKey) return res.status(400).json({ error: { message: "API 키가 필요합니다." } });

  /* ─── 모드별 프롬프트 분기 ─── */
  let systemPrompt, messages;

  if (mode === "generate_similar") {
    // 유사 문제 생성 모드 (텍스트 기반)
    if (!problemContext) return res.status(400).json({ error: { message: "문제 정보가 필요합니다." } });

    systemPrompt = "당신은 중학교·고등학교 수학 교육 전문가입니다.\n주어진 원본 문제의 개념과 공식을 활용하여 비슷한 유형의 새 문제 2개를 만드세요.\nJSON 외의 텍스트(설명, 마크다운 코드블록 등)는 절대 포함하지 마세요.\n\n응답 형식:\n{\"problems\":[{\"title\":\"문제 제목\",\"grade\":\"학년\",\"unit\":\"단원명\",\"difficulty\":\"하/중/상\",\"tags\":[\"태그\"],\"problemText\":\"문제 전문 (학생이 풀 수 있도록 명확하게)\",\"solutionSteps\":[{\"num\":1,\"title\":\"단계명\",\"math\":\"수식\",\"explain\":\"설명\"}],\"finalAnswer\":\"핵심질문 = 답\",\"keyConcepts\":[\"개념\"],\"keyFormulas\":[\"공식\"],\"tip\":\"학습 팁\"}]}\n\n규칙:\n- 반드시 2개의 문제를 생성하세요.\n- 원본과 같은 개념/공식을 사용하되 숫자나 조건을 변경하세요.\n- 난이도는 원본과 비슷하게 유지하세요.\n- solutionSteps는 3~6단계로 작성하세요.\n- problemText는 학생이 읽고 바로 풀 수 있을 정도로 명확하고 완전하게 작성하세요.\n- finalAnswer는 반드시 \"질문 = 답\" 형식으로 10단어 이내로 쓰세요. 중간 계산 과정은 절대 포함하지 마세요. 예: \"x = 5\", \"넓이 = 36\", \"a+b = -1\"\n\n도형 문제 규칙 (매우 중요):\n- 도형이나 그래프가 필요한 문제는 problemText에 반드시 [도형 설명] 블록을 포함하세요.\n- [도형 설명] 블록은 problemText의 맨 앞에 배치하고, 그 뒤에 빈 줄(\\n\\n)을 넣은 후 실제 질문을 작성하세요.\n- [도형 설명] 블록 작성 규칙:\n  1) 도형의 종류를 먼저 명시 (예: 직각삼각형, 평행사변형, 원, 좌표평면 등)\n  2) 각 꼭짓점/점의 이름을 알파벳으로 지정\n  3) 변의 길이, 각도 등 수치를 명확히 기재\n  4) 보조선, 수선, 연장선 등 추가 요소를 순서대로 설명\n  5) 학생이 이 설명만 읽고 정확히 도형을 그릴 수 있어야 함\n- 예시:\n  \"[도형 설명] 직각삼각형 ABC: 꼭짓점 C에서 직각(90°), 변 AC = 6cm, 변 BC = 8cm, 빗변 AB를 연결합니다. 꼭짓점 A에서 변 BC에 수선 AH를 내립니다.\\n\\n위 삼각형에서 AH의 길이를 구하시오.\"\n- 도형이 필요 없는 순수 계산 문제(방정식, 부등식 등)에는 [도형 설명]을 넣지 마세요.";

    messages = [{
      role: "user",
      content: "아래 원본 문제를 참고하여 비슷한 유형의 문제 2개를 만들어주세요.\n\n" + problemContext,
    }];
  } else if (mode === "resolve_text") {
    // 텍스트 기반 재분석 모드 (유사 문제 재분석용)
    if (!problemContext) return res.status(400).json({ error: { message: "문제 정보가 필요합니다." } });

    systemPrompt = "당신은 중학교·고등학교 수학 교육 전문가입니다.\n주어진 수학 문제를 처음부터 다시 풀어주세요. 이전 풀이와 무관하게 독립적으로 풀이하세요.\nJSON 외의 텍스트(설명, 마크다운 코드블록 등)는 절대 포함하지 마세요.\n\n{\"title\":\"문제 요약 제목\",\"grade\":\"학년(중1/중2/중3/고1/고2/고3)\",\"unit\":\"단원명\",\"difficulty\":\"하 또는 중 또는 상\",\"tags\":[\"태그\"],\"problemText\":\"문제 원문\",\"solutionSteps\":[{\"num\":1,\"title\":\"단계명\",\"math\":\"수식\",\"explain\":\"설명\"}],\"finalAnswer\":\"문제의 최종 질문 = 답\",\"keyConcepts\":[\"개념\"],\"keyFormulas\":[\"공식\"],\"tip\":\"학습 팁\"}\n\n규칙:\n- solutionSteps는 3~6단계로 작성하세요.\n- math 필드에는 수식을 텍스트로 표기하세요.\n- finalAnswer는 반드시 \"질문 = 답\" 형식으로 10단어 이내로 쓰세요. 중간 계산 과정은 절대 포함하지 마세요.\n  올바른 예: \"a+b = -1\", \"x = 3\", \"넓이 = 24\"\n  틀린 예(이렇게 쓰면 안 됨): \"lim_{x→1} ... = -2·2/2 = ... = -1\"";

    messages = [{
      role: "user",
      content: "아래 수학 문제를 처음부터 다시 풀어주세요.\n\n" + problemContext,
    }];
  } else {
    // 기본 모드: 이미지 분석
    if (!imageBase64) return res.status(400).json({ error: { message: "이미지가 필요합니다." } });

    systemPrompt = "당신은 중학교·고등학교 수학 교육 전문가입니다.\n학생이 업로드한 수학 문제 이미지를 분석하고 아래 JSON 형식으로만 응답하세요.\nJSON 외의 텍스트(설명, 마크다운 코드블록 등)는 절대 포함하지 마세요.\n\n{\"title\":\"문제 요약 제목\",\"grade\":\"학년(중1/중2/중3/고1/고2/고3)\",\"unit\":\"단원명\",\"difficulty\":\"하 또는 중 또는 상\",\"tags\":[\"태그\"],\"problemText\":\"문제 원문\",\"errorStep\":null,\"errorAnalysis\":null,\"solutionSteps\":[{\"num\":1,\"title\":\"단계명\",\"math\":\"수식\",\"explain\":\"설명\"}],\"finalAnswer\":\"문제의 최종 질문 = 답\",\"keyConcepts\":[\"개념\"],\"keyFormulas\":[\"공식\"],\"tip\":\"학습 팁\"}\n\n규칙:\n- 풀이가 포함된 이미지면 학생의 오류를 찾아 errorStep(번호)과 errorAnalysis(설명)를 채우세요.\n- 문제만 있으면 올바른 풀이를 작성하고 errorStep/errorAnalysis는 null로 두세요.\n- solutionSteps는 3~6단계로 작성하세요.\n- math 필드에는 수식을 텍스트로 표기하세요.\n- finalAnswer는 반드시 \"질문 = 답\" 형식으로 10단어 이내로 쓰세요. 중간 풀이 과정·계산 체인은 절대 포함하지 마세요.\n  올바른 예: \"a+b = -1\", \"x = 3\", \"넓이 = 24\", \"최솟값 = 2\", \"x = 3 또는 x = -2\"\n  틀린 예(이렇게 쓰면 안 됨): \"lim_{x→1} ... = -2·2/2 = -2a+b = 1+(-2) = -1\"";

    messages = [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: imageBase64 } },
        { type: "text", text: "이 수학 문제를 분석해주세요. 풀이가 있다면 틀린 부분을 찾아주세요." },
      ],
    }];
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: { message: error.message || "서버 오류" } });
  }
};
