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

  const { imageBase64, mimeType, apiKey } = req.body;

  if (!apiKey) return res.status(400).json({ error: { message: "API 키가 필요합니다." } });
  if (!imageBase64) return res.status(400).json({ error: { message: "이미지가 필요합니다." } });

  const systemPrompt = "당신은 중학교·고등학교 수학 교육 전문가입니다.\n학생이 업로드한 수학 문제 이미지를 분석하고 아래 JSON 형식으로만 응답하세요.\nJSON 외의 텍스트(설명, 마크다운 코드블록 등)는 절대 포함하지 마세요.\n\n{\"title\":\"문제 요약 제목\",\"grade\":\"학년(중1/중2/중3/고1/고2/고3)\",\"unit\":\"단원명\",\"difficulty\":\"하 또는 중 또는 상\",\"tags\":[\"태그\"],\"problemText\":\"문제 원문\",\"errorStep\":null,\"errorAnalysis\":null,\"solutionSteps\":[{\"num\":1,\"title\":\"단계명\",\"math\":\"수식\",\"explain\":\"설명\"}],\"finalAnswer\":\"문제의 최종 질문 = 답\",\"keyConcepts\":[\"개념\"],\"keyFormulas\":[\"공식\"],\"tip\":\"학습 팁\"}\n\n규칙:\n- 풀이가 포함된 이미지면 학생의 오류를 찾아 errorStep(번호)과 errorAnalysis(설명)를 채우세요.\n- 문제만 있으면 올바른 풀이를 작성하고 errorStep/errorAnalysis는 null로 두세요.\n- solutionSteps는 3~6단계로 작성하세요.\n- math 필드에는 수식을 텍스트로 표기하세요.\n- finalAnswer는 문제가 묻는 핵심 질문과 최종 답을 간결하게 작성하세요. 예시: \"자연수 a의 최솟값 = 2\", \"삼각형 넓이 = 24\", \"x = 3 또는 x = -2\", \"경우의 수 = 216\". 수식 전개 과정은 포함하지 말고, 질문과 답만 쓰세요.";

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
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: imageBase64 } },
            { type: "text", text: "이 수학 문제를 분석해주세요. 풀이가 있다면 틀린 부분을 찾아주세요." },
          ],
        }],
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
