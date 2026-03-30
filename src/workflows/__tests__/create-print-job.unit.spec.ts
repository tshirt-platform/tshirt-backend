describe("createPrintJobStep", () => {
  const mockCreateForOrder = jest.fn()
  const mockCancel = jest.fn()
  const mockContainer = {
    resolve: jest.fn().mockReturnValue({
      createForOrder: mockCreateForOrder,
      cancel: mockCancel,
    }),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  async function runCreatePrintJob(input: {
    order_id: string
    items: Array<{ design_png_url: string; design_json_url: string }>
  }) {
    const printOrderService = mockContainer.resolve("printOrder")
    const printJobIds: string[] = []

    for (const item of input.items) {
      const job = await printOrderService.createForOrder({
        order_id: input.order_id,
        design_png_url: item.design_png_url,
        design_json_url: item.design_json_url,
      })
      printJobIds.push(job.id)
    }

    return { print_job_ids: printJobIds }
  }

  async function runCompensation(data: { print_job_ids: string[] }) {
    const printOrderService = mockContainer.resolve("printOrder")
    for (const id of data.print_job_ids) {
      await printOrderService.cancel(id)
    }
  }

  it("creates print jobs and returns job IDs", async () => {
    mockCreateForOrder
      .mockResolvedValueOnce({ id: "pj_1" })
      .mockResolvedValueOnce({ id: "pj_2" })

    const result = await runCreatePrintJob({
      order_id: "order_123",
      items: [
        {
          design_png_url: "https://s3.example.com/front.png",
          design_json_url: "https://s3.example.com/front.json",
        },
        {
          design_png_url: "https://s3.example.com/back.png",
          design_json_url: "https://s3.example.com/back.json",
        },
      ],
    })

    expect(result.print_job_ids).toEqual(["pj_1", "pj_2"])
    expect(mockCreateForOrder).toHaveBeenCalledTimes(2)
    expect(mockCreateForOrder).toHaveBeenCalledWith({
      order_id: "order_123",
      design_png_url: "https://s3.example.com/front.png",
      design_json_url: "https://s3.example.com/front.json",
    })
  })

  it("compensation cancels all created jobs", async () => {
    await runCompensation({ print_job_ids: ["pj_1", "pj_2"] })

    expect(mockCancel).toHaveBeenCalledTimes(2)
    expect(mockCancel).toHaveBeenCalledWith("pj_1")
    expect(mockCancel).toHaveBeenCalledWith("pj_2")
  })
})
