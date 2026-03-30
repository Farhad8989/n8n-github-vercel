"""
Simplified generate workflow: Next.js handles image upload to S3.
n8n receives { imageId, prompt } and calls Leonardo /generations-image-to-video.
"""
import json

with open('d:/AI/Projects/Claude/n8n-guthub-vercel/n8n/wf_gen.json') as f:
    wf = json.load(f)

D = '$'
CRED = {'httpHeaderAuth': {'id': '3F23NaWcaXUh9cQ0', 'name': 'Leonardo API'}}

nodes = [
    {
        'id': 'webhook-generate',
        'name': 'Webhook',
        'type': 'n8n-nodes-base.webhook',
        'typeVersion': 2,
        'position': [240, 300],
        'webhookId': 'generate-video',
        'parameters': {
            'path': 'generate-video',
            'httpMethod': 'POST',
            'responseMode': 'responseNode',
            'options': {}
        }
    },
    {
        'id': 'validate-input',
        'name': 'Validate Input',
        'type': 'n8n-nodes-base.code',
        'typeVersion': 2,
        'position': [460, 300],
        'parameters': {
            'mode': 'runOnceForAllItems',
            'jsCode': (
                "const body = $input.first().json.body || {};\n"
                "const imageId = body.imageId;\n"
                "const prompt = body.prompt;\n"
                "if (!imageId) throw new Error('Missing imageId');\n"
                "if (!prompt) throw new Error('Missing prompt');\n"
                "return [{ json: { imageId, prompt: prompt.trim() } }];"
            )
        }
    },
    {
        'id': 'generate-video',
        'name': 'Generate Video',
        'type': 'n8n-nodes-base.httpRequest',
        'typeVersion': 4,
        'position': [680, 300],
        'parameters': {
            'method': 'POST',
            'url': 'https://cloud.leonardo.ai/api/rest/v1/generations-image-to-video',
            'authentication': 'predefinedCredentialType',
            'nodeCredentialType': 'httpHeaderAuth',
            'sendBody': True,
            'specifyBody': 'json',
            'jsonBody': '={"imageId": "{{' + D + 'json.imageId}}", "imageType": "UPLOADED", "prompt": "{{' + D + 'json.prompt}}", "isPublic": false}',
            'options': {}
        },
        'credentials': CRED
    },
    {
        'id': 'format-response',
        'name': 'Format Response',
        'type': 'n8n-nodes-base.code',
        'typeVersion': 2,
        'position': [900, 300],
        'parameters': {
            'mode': 'runOnceForAllItems',
            'jsCode': (
                "const data = $input.first().json;\n"
                "const generationId = data.sdGenerationJob && data.sdGenerationJob.generationId;\n"
                "if (!generationId) throw new Error('Leonardo did not return a generation ID. Response: ' + JSON.stringify(data));\n"
                "return [{ json: { taskId: generationId, status: 'pending' } }];"
            )
        }
    },
    {
        'id': 'respond-generate',
        'name': 'Respond to Webhook',
        'type': 'n8n-nodes-base.respondToWebhook',
        'typeVersion': 1,
        'position': [1120, 300],
        'parameters': {
            'responseBody': '={{ JSON.stringify(' + D + 'json) }}',
            'options': {
                'responseCode': 200,
                'responseHeaders': {
                    'entries': [{'name': 'Content-Type', 'value': 'application/json'}]
                }
            }
        }
    }
]

connections = {
    'Webhook': {'main': [[{'node': 'Validate Input', 'type': 'main', 'index': 0}]]},
    'Validate Input': {'main': [[{'node': 'Generate Video', 'type': 'main', 'index': 0}]]},
    'Generate Video': {'main': [[{'node': 'Format Response', 'type': 'main', 'index': 0}]]},
    'Format Response': {'main': [[{'node': 'Respond to Webhook', 'type': 'main', 'index': 0}]]}
}

output = {
    'name': wf['name'],
    'nodes': nodes,
    'connections': connections,
    'settings': wf['settings']
}

out_path = 'd:/AI/Projects/Claude/n8n-guthub-vercel/n8n/wf_gen_v2.json'
with open(out_path, 'w') as f:
    json.dump(output, f, indent=2)

print(f'Built {len(nodes)}-node simplified workflow -> {out_path}')
for n in nodes:
    print(' ', n['name'])
